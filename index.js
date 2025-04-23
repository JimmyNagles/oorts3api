const express = require("express");
const AWS = require("aws-sdk");
require("dotenv").config();

const app = express();
const port = 3000;

// Serve static files from 'public' folder
app.use(express.static("public"));

// Configure the AWS SDK to use the OORT endpoint and your credentials
const s3 = new AWS.S3({
  endpoint: process.env.OORT_ENDPOINT,
  accessKeyId: process.env.OORT_ACCESS_KEY_ID,
  secretAccessKey: process.env.OORT_SECRET_ACCESS_KEY,
  s3ForcePathStyle: true,
  signatureVersion: "v4",
});

AWS.config.update({ region: "us-east-1" });

// Parse JSON request bodies
app.use(express.json());

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
    res.json(data.Contents || []);
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

// Endpoint to rename an object in a bucket
app.get("/api/rename-object/:bucketName/:oldKey/:newKey", async (req, res) => {
  const { bucketName, oldKey, newKey } = req.params;

  try {
    // Copy the object to the new key
    await s3
      .copyObject({
        Bucket: bucketName,
        CopySource: `${bucketName}/${oldKey}`,
        Key: newKey,
      })
      .promise();

    // Delete the original object
    await s3
      .deleteObject({
        Bucket: bucketName,
        Key: oldKey,
      })
      .promise();

    res.json({ success: true, message: "File renamed successfully" });
  } catch (err) {
    console.log("Server Error:", err);
    res.status(500).send({ error: err.message });
  }
});

// Endpoint to get a signed URL for viewing/downloading an object
app.get("/api/view-url/:bucketName/:fileName", async (req, res) => {
  const { bucketName, fileName } = req.params;
  const params = {
    Bucket: bucketName,
    Key: fileName,
    Expires: 3600, // URL expires in 1 hour
  };
  try {
    const url = await s3.getSignedUrlPromise("getObject", params);
    res.json({ viewUrl: url });
  } catch (err) {
    console.log("Server Error:", err);
    res.status(500).send({ error: err.message });
  }
});

// Endpoint to create a new bucket
app.post("/api/create-bucket", async (req, res) => {
  const { bucketName, region } = req.body;
  const bucketRegion = region || "us-east-1"; // Default to us-east-1 if not specified

  if (!bucketName) {
    return res.status(400).send({ error: "Bucket name is required" });
  }

  // Validate bucket name according to S3 requirements
  const bucketNameRegex = /^[a-z0-9][a-z0-9.-]{1,61}[a-z0-9]$/;
  if (!bucketNameRegex.test(bucketName)) {
    return res.status(400).send({
      error:
        "Invalid bucket name. Bucket names must be between 3 and 63 characters long, contain only lowercase letters, numbers, dots, and hyphens, start and end with a letter or number, and cannot contain two adjacent periods.",
    });
  }

  try {
    const params = {
      Bucket: bucketName,
      CreateBucketConfiguration:
        bucketRegion !== "us-east-1"
          ? {
              LocationConstraint: bucketRegion,
            }
          : undefined,
    };

    try {
      await s3.createBucket(params).promise();

      // Only set CORS if bucket was successfully created
      // Set default bucket policy for public access
      const corsParams = {
        Bucket: bucketName,
        CORSConfiguration: {
          CORSRules: [
            {
              AllowedHeaders: ["*"],
              AllowedMethods: ["GET", "PUT", "POST", "DELETE", "HEAD"],
              AllowedOrigins: ["*"],
              ExposeHeaders: ["ETag"],
            },
          ],
        },
      };

      try {
        await s3.putBucketCors(corsParams).promise();
      } catch (corsErr) {
        console.log("Warning: Failed to set CORS policy:", corsErr);
        // Continue even if CORS setting fails
      }

      res.json({
        success: true,
        message: `Bucket '${bucketName}' created successfully in region ${bucketRegion}`,
        bucketName,
        region: bucketRegion,
      });
    } catch (createErr) {
      // Handle specific bucket creation errors
      if (createErr.code === "BucketAlreadyExists") {
        return res.status(409).send({
          error:
            "A bucket with this name already exists. Bucket names must be unique across all AWS accounts.",
        });
      } else if (createErr.code === "BucketAlreadyOwnedByYou") {
        return res.status(409).send({
          error: "You already own a bucket with this name.",
        });
      } else {
        throw createErr; // Re-throw for the outer catch block
      }
    }
  } catch (err) {
    console.log("Server Error creating bucket:", err);
    res.status(500).send({ error: err.message, code: err.code });
  }
});

app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
});
