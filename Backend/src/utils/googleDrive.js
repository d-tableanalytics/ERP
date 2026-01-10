const { google } = require('googleapis');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

// Load the service account credentials from the file path in .env
const SERVICE_ACCOUNT_FILE = process.env.GOOGLE_SERVICE_ACCOUNT_PATH;
const FOLDER_ID = process.env.GOOGLE_DRIVE_FOLDER_ID;

if (!SERVICE_ACCOUNT_FILE || !FOLDER_ID) {
    console.error('GOOGLE_SERVICE_ACCOUNT_PATH or GOOGLE_DRIVE_FOLDER_ID is missing in .env');
}

const auth = new google.auth.GoogleAuth({
    keyFile: SERVICE_ACCOUNT_FILE,
    scopes: ['https://www.googleapis.com/auth/drive.file'],
});

const drive = google.drive({ version: 'v3', auth });

/**
 * Uploads a file to Google Drive
 * @param {Buffer} fileBuffer - The file content
 * @param {string} filename - The name of the file
 * @param {string} mimeType - The file's MIME type
 * @returns {Promise<string>} - The webViewLink of the uploaded file
 */
const uploadToDrive = async (fileBuffer, filename, mimeType) => {
    try {
        const fileMetadata = {
            name: `${Date.now()}_${filename}`,
            parents: [FOLDER_ID]
        };
        const media = {
            mimeType: mimeType,
            body: require('stream').Readable.from(fileBuffer)
        };

        const res = await drive.files.create({
            resource: fileMetadata,
            media: media,
            fields: 'id, webViewLink'
        });

        // Set file as viewable to anyone with the link (optional, depends on security needs)
        await drive.permissions.create({
            fileId: res.data.id,
            requestBody: {
                role: 'reader',
                type: 'anyone',
            },
        });

        return res.data.webViewLink;
    } catch (error) {
        console.error('Error uploading to Google Drive:', error);
        throw error;
    }
};

module.exports = { uploadToDrive };
