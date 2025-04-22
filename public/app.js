document.addEventListener("DOMContentLoaded", function () {
  // Variable to store the currently selected bucket name
  let currentBucket = null;

  // Initial fetch of buckets when the page loads
  fetchBuckets();

  // Fetches the list of buckets from the server API
  async function fetchBuckets() {
    try {
      const response = await fetch("/api/list-buckets");
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      const buckets = await response.json();
      const bucketList = document.getElementById("buckets");
      bucketList.innerHTML = ""; // Clear existing list

      if (!buckets || buckets.length === 0) {
        bucketList.innerHTML = "<li>No buckets found.</li>";
        return;
      }

      // Populate the bucket list in the HTML
      buckets.forEach((bucket) => {
        const li = document.createElement("li");
        li.textContent = bucket.Name;
        // Add click event to fetch objects when a bucket is selected
        li.onclick = () => fetchObjects(bucket.Name);
        bucketList.appendChild(li);
      });
    } catch (error) {
      console.error("Error fetching buckets:", error);
      showNotification(
        "Failed to fetch buckets. See console for details.",
        true
      );
      const bucketList = document.getElementById("buckets");
      bucketList.innerHTML = "<li>Error loading buckets.</li>";
    }
  }

  // Fetches the list of objects for a given bucket name
  async function fetchObjects(bucketName) {
    currentBucket = bucketName; // Store the selected bucket name
    const objectsList = document.getElementById("objects");
    const uploadSection = document.getElementById("uploadSection");
    objectsList.innerHTML = "<li>Loading objects...</li>"; // Indicate loading
    uploadSection.style.display = "none"; // Hide upload section initially

    // Clear any existing upload status when switching buckets
    const statusElement = document.getElementById("uploadStatus");
    if (statusElement) {
      statusElement.textContent = "";
    }

    // Clear file input when switching buckets
    const fileInput = document.getElementById("fileInput");
    if (fileInput) {
      fileInput.value = "";
    }

    try {
      const response = await fetch(`/api/list-objects/${bucketName}`);
      if (!response.ok) {
        const errorData = await response
          .json()
          .catch(() => ({ error: "Unknown error fetching objects" })); // Try to parse error
        throw new Error(
          errorData.error || `HTTP error! status: ${response.status}`
        );
      }
      const objects = await response.json();

      objectsList.innerHTML = ""; // Clear previous objects/loading message
      if (!objects || objects.length === 0) {
        objectsList.innerHTML = "<li>No objects found in this bucket.</li>";
      } else {
        // Populate the object list in the HTML
        objects.forEach((object) => {
          const li = document.createElement("li");
          // Display object key and last modified date
          const lastModified = new Date(object.LastModified).toLocaleString();
          li.textContent = `${object.Key} (Last Modified: ${lastModified})`;
          objectsList.appendChild(li);
        });
      }

      // Show the upload section now that a bucket is selected
      uploadSection.style.display = "block";
      document.getElementById("uploadBucketName").textContent = bucketName; // Show which bucket is selected for upload
    } catch (error) {
      console.error(`Error fetching objects for bucket ${bucketName}:`, error);
      showNotification(
        `Failed to fetch objects for bucket ${bucketName}. ${error.message}`,
        true
      );
      objectsList.innerHTML = `<li>Error loading objects for ${bucketName}.</li>`;
    }
  }

  // Gets a pre-signed URL from the server for uploading a file
  async function getSignedUrl(bucketName, fileName, contentType) {
    try {
      const url = `/api/upload-url/${bucketName}/${fileName}?contentType=${encodeURIComponent(
        contentType
      )}`;
      const response = await fetch(url);
      if (!response.ok) {
        const errorData = await response
          .json()
          .catch(() => ({ error: "Unknown error getting upload URL" }));
        throw new Error(
          errorData.error || `HTTP error! status: ${response.status}`
        );
      }
      const data = await response.json();
      return data.uploadUrl;
    } catch (err) {
      console.error("Error getting signed URL:", err);
      showNotification(`Error getting upload URL: ${err.message}`, true);
      // Rethrow the error to be caught by the calling function (uploadFile)
      throw err;
    }
  }

  // Function to show notification in the UI
  function showNotification(message, isError = false) {
    // Create notification element if it doesn't exist
    let notification = document.getElementById("notification");
    if (!notification) {
      notification = document.createElement("div");
      notification.id = "notification";
      notification.style.position = "fixed";
      notification.style.top = "20px";
      notification.style.right = "20px";
      notification.style.padding = "15px 20px";
      notification.style.borderRadius = "5px";
      notification.style.boxShadow = "0 4px 8px rgba(0,0,0,0.1)";
      notification.style.zIndex = "1000";
      notification.style.transition = "opacity 0.3s ease-in-out";
      notification.style.opacity = "0";
      document.body.appendChild(notification);
    }

    // Set styles based on message type
    if (isError) {
      notification.style.backgroundColor = "#f8d7da";
      notification.style.color = "#721c24";
      notification.style.borderLeft = "4px solid #dc3545";
    } else {
      notification.style.backgroundColor = "#d4edda";
      notification.style.color = "#155724";
      notification.style.borderLeft = "4px solid #28a745";
    }

    // Set message and show notification
    notification.textContent = message;
    notification.style.opacity = "1";

    // Hide notification after 5 seconds
    setTimeout(() => {
      notification.style.opacity = "0";
    }, 5000);
  }

  // Function to update upload progress in the UI
  function updateUploadStatus(message) {
    const statusElement = document.getElementById("uploadStatus");
    if (statusElement) {
      statusElement.textContent = message;
    }
  }

  // Handles the file upload process
  async function uploadFile() {
    const fileInput = document.getElementById("fileInput");
    const file = fileInput.files[0];

    // Create or update upload status element
    let statusElement = document.getElementById("uploadStatus");
    if (!statusElement) {
      statusElement = document.createElement("div");
      statusElement.id = "uploadStatus";
      statusElement.style.marginTop = "10px";
      statusElement.style.fontWeight = "bold";
      document.getElementById("uploadSection").appendChild(statusElement);
    }
    statusElement.textContent = "";

    if (!file) {
      showNotification("Please select a file to upload.", true);
      return;
    }

    if (!currentBucket) {
      showNotification("Please select a bucket first.", true);
      return;
    }

    try {
      updateUploadStatus(`Preparing to upload ${file.name}...`);

      // 1. Get the pre-signed URL with the correct content type
      const contentType = file.type || "application/octet-stream";
      const signedUrl = await getSignedUrl(
        currentBucket,
        file.name,
        contentType
      );

      updateUploadStatus(`Uploading ${file.name}...`);

      // 2. Upload the file directly to the S3-compatible storage using the signed URL
      const uploadResponse = await fetch(signedUrl, {
        method: "PUT",
        headers: {
          // Pass the correct Content-Type of the file
          "Content-Type": file.type || "application/octet-stream",
        },
        body: file,
      });

      if (!uploadResponse.ok) {
        // Attempt to get error details from the S3 response if possible
        const errorText = await uploadResponse.text();
        throw new Error(
          `Upload failed! Status: ${uploadResponse.status}. ${errorText}`
        );
      }

      showNotification(`${file.name} uploaded successfully!`);
      updateUploadStatus(`${file.name} uploaded successfully!`);
      fetchObjects(currentBucket); // Refresh the object list to show the new file
      fileInput.value = ""; // Clear the file input
    } catch (err) {
      console.error("Error uploading file:", err);
      showNotification(`Error uploading file: ${err.message}`, true);
      updateUploadStatus(`Upload failed: ${err.message}`);
    }
  }

  // Make the uploadFile function available globally so the HTML button can call it
  window.uploadFile = uploadFile;
});
