# OORT S3 Bucket Viewer & Manager

A full-featured web application for interacting with OORT's S3-compatible object storage. This application demonstrates how to use the AWS SDK to connect to OORT Storage, and provides a modern web interface for bucket and object management.

## Features

- 📂 Create and manage S3 buckets
- 📁 Browse and manage objects within buckets
- 🔄 Upload files using pre-signed URLs
- 🔍 Preview images, videos, audio, and text files
- ✏️ Rename objects within buckets
- 📊 View object metadata (size, last modified date)
- 🔐 Secure authentication via environment variables

## Getting Started

### Prerequisites

- Node.js 14+ installed
- An OORT Storage account with access credentials
- S3-compatible storage endpoint from OORT

### Setup

1. Clone this repository:

   ```bash
   git clone https://github.com/yourusername/oorts3api.git
   cd oorts3api
   ```

2. Install dependencies:

   ```bash
   npm install
   ```

3. Create a `.env` file in the project root with your OORT credentials:

   ```
   OORT_ENDPOINT=https://your-oort-s3-endpoint.com
   OORT_ACCESS_KEY_ID=your-access-key
   OORT_SECRET_ACCESS_KEY=your-secret-key
   ```

4. Start the development server:

   ```bash
   npm run dev
   ```

5. Open your browser and navigate to:
   ```
   http://localhost:3000
   ```

## Environment Variables

| Variable                 | Description                              | Example                                    |
| ------------------------ | ---------------------------------------- | ------------------------------------------ |
| `OORT_ENDPOINT`          | Your OORT S3-compatible storage endpoint | `https://s3-standard.oortech.com`          |
| `OORT_ACCESS_KEY_ID`     | Your OORT access key ID                  | `AKIAIOSFODNN7EXAMPLE`                     |
| `OORT_SECRET_ACCESS_KEY` | Your OORT secret access key              | `wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY` |

## API Endpoints

This application provides the following RESTful API endpoints:

| Endpoint                                         | Method | Description                                 |
| ------------------------------------------------ | ------ | ------------------------------------------- |
| `/api/list-buckets`                              | GET    | List all available buckets                  |
| `/api/list-objects/:bucketName`                  | GET    | List objects in a specific bucket           |
| `/api/upload-url/:bucketName/:fileName`          | GET    | Generate signed URL for file upload         |
| `/api/view-url/:bucketName/:fileName`            | GET    | Generate signed URL for viewing/downloading |
| `/api/rename-object/:bucketName/:oldKey/:newKey` | GET    | Rename an object in a bucket                |
| `/api/create-bucket`                             | POST   | Create a new bucket                         |

## Usage Examples

### Creating a Bucket

```javascript
// Client-side JavaScript
async function createBucket(bucketName) {
  const response = await fetch("/api/create-bucket", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ bucketName }),
  });

  const result = await response.json();
  console.log(result);
}
```

### Uploading a File

```javascript
// Client-side JavaScript
async function uploadFile(bucketName, file) {
  // 1. Get a pre-signed URL
  const response = await fetch(
    `/api/upload-url/${bucketName}/${file.name}?contentType=${file.type}`
  );
  const { uploadUrl } = await response.json();

  // 2. Use the URL to upload the file directly to S3
  await fetch(uploadUrl, {
    method: "PUT",
    headers: {
      "Content-Type": file.type,
    },
    body: file,
  });
}
```

## Architecture

This application follows a simple architecture:

- **Backend**: Node.js + Express server that communicates with OORT S3 API
- **Frontend**: Vanilla JavaScript web application for the user interface
- **Storage**: OORT's S3-compatible storage service

The backend server acts as a proxy between the frontend and OORT S3, handling authentication and generating pre-signed URLs for secure file operations.

## Troubleshooting

### Connection Issues

If you're experiencing connection issues to OORT storage:

1. Verify your endpoint URL in the `.env` file
2. Check that your access keys are correct
3. Confirm your network allows connections to the endpoint
4. Try using a different region if available

### Bucket Creation Issues

When creating buckets:

1. Ensure bucket names follow S3 naming conventions (lowercase, no underscores, etc.)
2. Bucket names must be globally unique across all OORT users
3. Check if you have sufficient permissions to create buckets

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

This project is licensed under the MIT License - see the LICENSE file for details.

## Acknowledgments

- OORT for providing S3-compatible storage
- AWS for the SDK

---

Built with ❤️ by [Your Name]
