const core = require('@actions/core');
const { S3Client, PutObjectCommand, GetObjectAttributesCommand } = require("@aws-sdk/client-s3");
const crypto = require('crypto');
const fs = require('fs');

async function run() {
    let files_updated = 0;
    try {
        const s3BucketName = core.getInput('S3_BUCKET_NAME');
        const s3AccessKeyID = core.getInput('S3_AWS_ACCESS_KEY_ID');
        const s3SecretAccessKey = core.getInput('S3_AWS_SECRET_ACCESS_KEY');
        const s3Region = core.getInput('S3_aws_region')
        const files = core.getMultilineInput('files');
        const keys = core.getMultilineInput('keys');

        if (files.length == 0 || keys.length != files.length) {
            core.setFailed('Files and Keys input must both present and the same non-zero length.');
            return;
        }

        const s3Client = new S3Client({
            region: s3Region,
            accessKeyId: s3AccessKeyID,
            secretAccessKey: s3SecretAccessKey
        });

        await Promise.all(files.map(async (fileName, fileIndex) => {
            const key = keys[fileIndex];
            const objectData = fs.readFileSync(fileName, 'utf8');
    
            let hashBase64 = crypto.createHash('md5').update(objectData).digest("base64");
            let hashHex = crypto.createHash('md5').update(objectData).digest("hex");
    
            try {
                const getObjectAttributesCommand = new GetObjectAttributesCommand({
                    Bucket: s3BucketName,
                    Key: key,
                    ObjectAttributes: ['ETag', 'StorageClass']
                });
                let getObjectAttributesResult = await s3Client.send(getObjectAttributesCommand);
                if (getObjectAttributesResult.ETag == hashHex) {
                    return false;
                }
            } catch (error) {
                // object doesn't exist, upload
            }
    
            const uploadCommand = new PutObjectCommand({
                Body: objectData,
                ContentMD5: hashBase64,
                Bucket: s3BucketName,
                Key: key
            });
    
            await s3Client.send(uploadCommand);
    
            files_updated++;
        }));
        core.setOutput("files_updated", files_updated);
        // Get the JSON webhook payload for the event that triggered the workflow
        //   const payload = JSON.stringify(github.context.payload, undefined, 2)
        //   console.log(`The event payload: ${payload}`);
    } catch (error) {
        core.setFailed(error.message);
    }
}

run();
