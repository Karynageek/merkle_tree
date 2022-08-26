const fs = require("fs")
const path = require("path")

function writeToFiles(dirPath, originalPath, arrayOfFiles) {
  files = fs.readdirSync(dirPath)

  arrayOfFiles = arrayOfFiles || []
  originalPath = originalPath || path.resolve(dirPath, "..")

  folder = path.relative(originalPath, path.join(dirPath, "/"))

  arrayOfFiles.push({
    path: folder.replace(/\\/g, "/"),
    mtime: fs.statSync(originalPath + "/" + folder).mtime
  })

  files.forEach(function (fileName) {
    if (getExtension(fileName) != 'json') {
      return;
    }

    try {
      const file = path.join(dirPath, "/", fileName)

      const arrays = fs.readFileSync(file)

      const object = JSON.parse(arrays)

      validateKeys(file, object)

      object.image = process.argv[3] + fileName.toString().split(".")[0] + '.webp';
      object['properties']['files'][0]['uri'] = process.argv[3] + fileName.toString().split(".")[0] + '.webp';

      const newData = JSON.stringify(object, null, 2)

      fs.writeFileSync(file, newData)

    } catch (e) {
      console.log(e.name, e.message);
    }
  })

  return arrayOfFiles
}

function validateKeys(file, object) {
  if (object.name == null || object.description == null || object.image == null) {
    throw new Error('Name, image or description is empty in file: ' + file)
  }
}

function getExtension(filename) {
  const ext = path.extname(filename || '').split('.');
  return ext[ext.length - 1];
}

async function run() {
  writeToFiles(process.argv[2])
}

run()

//node scripts\upload-folder-to-ipfs.js images https://ipfs.infura.io:5001/api/v0
//node scripts\edit-ipfs-image-uri.js json ipfs://QmUvTT1h2UHxGdxNP5DQWmT6rPuvWm7nx4pREobMc2WRW5/
//node scripts\upload-folder-to-ipfs.js json https://ipfs.infura.io:5001/api/v0

//node [path to script] <folder to upload> <host URL>
//node [path to script]<folder to edit> <ipfs URL>
