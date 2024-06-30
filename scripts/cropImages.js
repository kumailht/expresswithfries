const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

const inputDirectory = './public/screenshots/listings/';

fs.readdir(inputDirectory, (err, files) => {
    if (err) {
        console.error('Error reading directory:', err);
        return;
    }

    files.forEach((file) => {
        const filePath = path.join(inputDirectory, file);
        console.log(filePath);

        // Check if the file is an image (you may want to add more image formats)
        if (file.match(/\.(jpg|jpeg|png)$/i)) {
            cropAndOverwriteImage(filePath);
        }
    });
});

function cropAndOverwriteImage(filePath) {
    sharp(filePath)
    .extract({ left: 0, top: 0, width: 1072, height: 1900 }) // Crop height to be under 1900px
        .toBuffer()
        .then((data) => {
            fs.writeFileSync(filePath, data);
            console.log(`Image cropped and overwritten: ${filePath}`);
        })
        .catch((err) => {
            console.error('Error cropping image:', err);
        });
}
