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
          const objectDiv = document.createElement("div");
          objectDiv.className = "object-item";

          // Display object key and last modified date
          const lastModified = new Date(object.LastModified).toLocaleString();
          const objectInfo = document.createElement("span");
          objectInfo.textContent = `${object.Key} (Last Modified: ${lastModified})`;
          objectDiv.appendChild(objectInfo);

          // Add action buttons container
          const actionDiv = document.createElement("div");
          actionDiv.className = "object-actions";

          // Add rename button
          const renameBtn = document.createElement("button");
          renameBtn.textContent = "Rename";
          renameBtn.onclick = (e) => {
            e.stopPropagation();
            renameFile(object.Key);
          };
          actionDiv.appendChild(renameBtn);

          // Add view/preview button
          const viewBtn = document.createElement("button");
          viewBtn.textContent = "View";
          viewBtn.onclick = (e) => {
            e.stopPropagation();
            previewFile(object.Key);
          };
          actionDiv.appendChild(viewBtn);

          objectDiv.appendChild(actionDiv);
          li.appendChild(objectDiv);
          objectsList.appendChild(li);
        });

        // Add some basic styling for the object items
        const style = document.createElement("style");
        style.textContent = `
          .object-item {
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding: 5px 0;
          }
          .object-actions {
            display: flex;
            gap: 5px;
          }
          .object-actions button {
            padding: 3px 8px;
            cursor: pointer;
          }
          .preview-modal {
            display: none;
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background-color: rgba(0,0,0,0.7);
            z-index: 1001;
            justify-content: center;
            align-items: center;
          }
          .preview-content {
            background-color: white;
            padding: 20px;
            border-radius: 5px;
            max-width: 90%;
            max-height: 90%;
            overflow: auto;
          }
          .preview-close {
            position: absolute;
            top: 15px;
            right: 15px;
            color: white;
            font-size: 30px;
            cursor: pointer;
          }
        `;
        document.head.appendChild(style);
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

  // Function to rename a file in the bucket
  async function renameFile(oldFileName) {
    if (!currentBucket) {
      showNotification("Please select a bucket first.", true);
      return;
    }

    const newFileNameBase = prompt(`Enter new name for ${oldFileName}:`);
    if (!newFileNameBase || newFileNameBase === oldFileName) {
      return; // User cancelled or didn't change the name
    }

    // Preserve the original file extension
    const oldExtensionMatch = oldFileName.match(/\.[^.]+$/);
    const oldExtension = oldExtensionMatch ? oldExtensionMatch[0] : "";
    let finalNewFileName = newFileNameBase;

    // Check if the new name already has an extension
    const newExtensionMatch = newFileNameBase.match(/\.[^.]+$/);
    if (!newExtensionMatch && oldExtension) {
      finalNewFileName += oldExtension; // Append old extension if new name doesn't have one
    }

    try {
      updateUploadStatus(`Renaming ${oldFileName} to ${finalNewFileName}...`);
      const response = await fetch(
        `/api/rename-object/${currentBucket}/${encodeURIComponent(
          oldFileName
        )}/${encodeURIComponent(finalNewFileName)}`
      );

      if (!response.ok) {
        const errorData = await response
          .json()
          .catch(() => ({ error: "Unknown error renaming file" }));
        throw new Error(
          errorData.error || `HTTP error! status: ${response.status}`
        );
      }

      const result = await response.json();
      showNotification(
        `File renamed successfully from ${oldFileName} to ${finalNewFileName}`
      );
      updateUploadStatus(`File renamed successfully`);
      fetchObjects(currentBucket); // Refresh the object list
    } catch (err) {
      console.error("Error renaming file:", err);
      showNotification(`Error renaming file: ${err.message}`, true);
      updateUploadStatus(`Rename failed: ${err.message}`);
    }
  }

  // Function to preview a file
  async function previewFile(fileName) {
    if (!currentBucket) {
      showNotification("Please select a bucket first.", true);
      return;
    }

    try {
      // Get a signed URL for viewing the file
      const response = await fetch(
        `/api/view-url/${currentBucket}/${encodeURIComponent(fileName)}`
      );

      if (!response.ok) {
        const errorData = await response
          .json()
          .catch(() => ({ error: "Unknown error getting view URL" }));
        throw new Error(
          errorData.error || `HTTP error! status: ${response.status}`
        );
      }

      const data = await response.json();
      const viewUrl = data.viewUrl;

      // Create or get the modal element
      let modal = document.getElementById("previewModal");
      if (!modal) {
        modal = document.createElement("div");
        modal.id = "previewModal";
        modal.className = "preview-modal";

        const closeBtn = document.createElement("span");
        closeBtn.className = "preview-close";
        closeBtn.innerHTML = "&times;";
        closeBtn.onclick = () => {
          modal.style.display = "none";
          const content = document.getElementById("previewContent");
          if (content) content.innerHTML = ""; // Clear content when closing
        };

        const content = document.createElement("div");
        content.id = "previewContent";
        content.className = "preview-content";

        modal.appendChild(closeBtn);
        modal.appendChild(content);
        document.body.appendChild(modal);
      }

      // Determine file type based on extension
      const fileExt = fileName.split(".").pop().toLowerCase();
      const content = document.getElementById("previewContent");
      content.innerHTML = ""; // Clear previous content

      if (["jpg", "jpeg", "png", "gif", "svg"].includes(fileExt)) {
        // Image preview
        const img = document.createElement("img");
        img.src = viewUrl;
        img.style.maxWidth = "100%";
        content.appendChild(img);
      } else if (["mp4", "webm", "ogg"].includes(fileExt)) {
        // Video preview
        const video = document.createElement("video");
        video.src = viewUrl;
        video.controls = true;
        video.style.maxWidth = "100%";
        content.appendChild(video);
      } else if (["mp3", "wav"].includes(fileExt)) {
        // Audio preview
        const audio = document.createElement("audio");
        audio.src = viewUrl;
        audio.controls = true;
        content.appendChild(audio);
      } else if (["txt", "log", "md", "csv", "json"].includes(fileExt)) {
        // Text preview - fetch and display content
        try {
          const textResponse = await fetch(viewUrl);
          const text = await textResponse.text();
          const pre = document.createElement("pre");
          pre.textContent = text;
          pre.style.maxHeight = "500px";
          pre.style.overflow = "auto";
          content.appendChild(pre);
        } catch (e) {
          content.innerHTML = `<p>Error loading text preview: ${e.message}</p>`;
        }
      } else if (["pdf"].includes(fileExt)) {
        // PDF preview
        const iframe = document.createElement("iframe");
        iframe.src = viewUrl;
        iframe.style.width = "100%";
        iframe.style.height = "500px";
        content.appendChild(iframe);
      } else {
        // Generic download link for other file types
        content.innerHTML = `
          <p>Preview not available for this file type.</p>
          <p><a href="${viewUrl}" target="_blank" download="${fileName}">Download ${fileName}</a></p>
        `;
      }

      // Show the modal
      modal.style.display = "flex";
    } catch (err) {
      console.error("Error previewing file:", err);
      showNotification(`Error previewing file: ${err.message}`, true);
    }
  }

  // Make functions available globally so HTML buttons can call them
  window.uploadFile = uploadFile;
  window.renameFile = renameFile;
  window.previewFile = previewFile;

  // Function to create a new bucket
  async function createBucket() {
    const bucketNameInput = document.getElementById("newBucketName");
    const bucketName = bucketNameInput.value.trim();

    if (!bucketName) {
      showNotification("Please enter a bucket name", true);
      return;
    }

    try {
      const response = await fetch("/api/create-bucket", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ bucketName }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to create bucket");
      }

      showNotification(`Bucket '${bucketName}' created successfully`);
      bucketNameInput.value = ""; // Clear the input field

      // Refresh the bucket list
      fetchBuckets();
    } catch (error) {
      console.error("Error creating bucket:", error);
      showNotification(`Failed to create bucket: ${error.message}`, true);
    }
  }

  // Expose createBucket to the window object so it can be called by HTML
  window.createBucket = createBucket;
});
