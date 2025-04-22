const express = require("express");
const AWS = require("aws-sdk");
require("dotenv").config();

const app = express();
const port = 3000;

// Serve static files from 'public' folder
app.use(express.static("public"));
// Configure the AWS SDK to use the OORT endpoint and your credentials
// Configure the AWS SDK to use the OORT endpoint and your credentials
const s3 = new AWS.S3({
  endpoint: process.env.OORT_ENDPOINT,
  accessKeyId: process.env.OORT_ACCESS_KEY_ID,
  secretAccessKey: process.env.OORT_SECRET_ACCESS_KEY,
  s3ForcePathStyle: true,
  signatureVersion: "v4",
});

AWS.config.update({ region: "us-east-1" });

// Endpoint to list buckets
app.get("/api/list-buckets", async (req, res) => {
  try {
    const data = await s3.listBuckets().promise();
    res.json(data.Buckets);
  } catch (err) {
    res.status(500).send({ error: err.message });
  }
});

// Endpoint to list objects in a bucket
app.get("/api/list-objects/:bucketName", async (req, res) => {
  const params = {
    Bucket: req.params.bucketName,
  };
  try {
    const data = await s3.listObjectsV2(params).promise();
    res.json(data.Contents);
  } catch (err) {
    console.log("Server Error:", err);
    res.status(500).send({ error: err.message });
  }
});

// Endpoint to generate a signed URL for uploading
app.get("/api/upload-url/:bucketName/:fileName", async (req, res) => {
  const { bucketName, fileName } = req.params;
  const contentType = req.query.contentType || "application/octet-stream";
  const params = {
    Bucket: bucketName,
    Key: fileName,
    Expires: 60, // URL expires in 60 seconds
    ContentType: contentType, // Use the content type from the request
  };
  try {
    const url = await s3.getSignedUrlPromise("putObject", params);
    res.json({ uploadUrl: url });
  } catch (err) {
    console.log("Server Error:", err);
    res.status(500).send({ error: err.message });
  }
});

app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
});
