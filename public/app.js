document.addEventListener("DOMContentLoaded", function () {
  fetchBuckets();

  async function fetchBuckets() {
    const response = await fetch("/api/list-buckets");
    const buckets = await response.json();
    const bucketList = document.getElementById("buckets");
    buckets.forEach((bucket) => {
      const li = document.createElement("li");
      li.textContent = bucket.Name;
      li.onclick = () => fetchObjects(bucket.Name);
      bucketList.appendChild(li);
    });
  }

  async function fetchObjects(bucketName) {
    currentBucket = bucketName;
    const response = await fetch(`/api/list-objects/${bucketName}`);
    const objects = await response.json();

    console.log(objects);
    const objectsList = document.getElementById("objects");
    objectsList.innerHTML = ""; // Clear previous objects
    if (objects.length === 0) {
      objectsList.innerHTML = "<li>No objects found in this bucket.</li>";
    }
    objects.forEach((object) => {
      const li = document.createElement("li");
      li.textContent = `${object.Key} (Last Modified: ${object.LastModified})`;
      objectsList.appendChild(li);
    });

    // Show upload section
    document.getElementById("uploadSection").style.display = "block";
  }

  async function getSignedUrl(bucketName, fileName) {
    try {
      const response = await fetch(`/api/upload-url/${bucketName}/${fileName}`);
      const data = await response.json();
      return data.uploadUrl;
    } catch (err) {
      console.error("Error getting signed URL:", err);
    }
  }

  async function uploadFile() {
    const fileInput = document.getElementById("fileInput");
    const file = fileInput.files[0];

    if (!file) {
      alert("Please select a file to upload.");
      return;
    }

    try {
      const signedUrl = await getSignedUrl(currentBucket, file.name);

      await fetch(signedUrl, {
        method: "PUT",
        headers: {
          "Content-Type": file.type,
        },
        body: file,
      });

      alert("File uploaded successfully!");
      fetchObjects(currentBucket); // Refresh the object list
    } catch (err) {
      console.error("Error uploading file:", err);
      alert("Error uploading file.");
    }
  }

  // Make the uploadFile function available globally
  window.uploadFile = uploadFile;
});
