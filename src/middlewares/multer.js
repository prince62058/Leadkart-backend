require("dotenv").config();
const { Credentials } = require("aws-sdk");
const S3 = require("aws-sdk/clients/s3");
const multer = require("multer");
const multerS3 = require("multer-s3");

// AWS S3 Client Setup
const s3Client = new S3({
  region: process.env.LINODE_OBJECT_STORAGE_REGION || "in-maa-1", // "in-maa-1"
  endpoint:
    process.env.LINODE_OBJECT_STORAGE_ENDPOINT || "in-maa-1.linodeobjects.com", // "in-maa-1.linodeobjects.com"
  sslEnabled: true,
  s3ForcePathStyle: false,
  credentials: new Credentials({
    accessKeyId: process.env.LINODE_OBJECT_ACCESS_KEY || "ONX5GHG5U5421621M63F",
    secretAccessKey:
      process.env.LINODE_OBJECT_SECRET_KEY ||
      "PRIwOYk72vYugYNfbqTI3pZkU36zNY0rEtxcIuzn",
  }),
});

exports.s3Client = s3Client;

// File Upload Filter Function
function multerFilter(req, file, cb) {
  const allowedMimeTypes = ["image/jpeg", "image/jpg", "image/png"];
  if (allowedMimeTypes.includes(file.mimetype)) {
    cb(null, true); // Accept the file
  } else {
    const error = new Error("Only JPEG, JPG, or PNG formats allowed!");
    error.status = 400; // Set the status code as needed
    cb(error, false); // Reject the file with an error
  }
}

// Multer Storage Configuration
const upload = multer({
  storage: multerS3({
    s3: s3Client,
    acl: "public-read",
    bucket: process.env.LINODE_OBJECT_BUCKET || "leadkart", // "leadkart"
    contentType: (req, file, cb) => {
      cb(null, file.mimetype);
    },
    metadata: (req, file, cb) => {
      cb(null, { fieldName: file.fieldname });
    },
    key: (req, file, cb) => {
      let folderPath = "";
      if (file.mimetype.startsWith("image")) {
        folderPath = "LEADKART/IMAGE/";
      } else if (file.mimetype.startsWith("video")) {
        folderPath = "LEADKART/VIDEO/";
      } else if (file.mimetype.startsWith("application/pdf")) {
        folderPath = "LEADKART/PDF/";
      } else {
        folderPath = "LEADKART/OTHERS/";
      }
      const key = `${folderPath}${Date.now().toString()}_${file.originalname}`;
      cb(null, key);
    },
  }),
});

// Export the upload function
exports.upload = upload;

// Function to Delete a File from Object Storage
exports.deleteFileFromObjectStorage = async (url) => {
  try {
    // Extract the path from the full URL
    const urlObject = new URL(url);
    const key = urlObject.pathname.substring(1); // Remove the leading slash

    const params = {
      Bucket: process.env.LINODE_OBJECT_BUCKET || "leadkart", // "leadkart"
      Key: key,
    };

    await s3Client.deleteObject(params).promise();
    console.log(`File deleted successfully: ${key}`);
  } catch (error) {
    console.error(`Error deleting file: ${error.message}`);
  }
};
