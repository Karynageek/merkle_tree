const fs = require("fs")
const path = require("path")
const ipfsClient = require('ipfs-http-client')

function getAllFiles(dirPath, originalPath, arrayOfFiles) {
  files = fs.readdirSync(dirPath)

  arrayOfFiles = arrayOfFiles || []
  originalPath = originalPath || path.resolve(dirPath, "..")

  folder = path.relative(originalPath, path.join(dirPath, "/"))

  arrayOfFiles.push({
    path: folder.replace(/\\/g, "/"),
    mtime: fs.statSync(originalPath + "/" + folder).mtime
  })

  files.forEach(function (file) {
    if (fs.statSync(dirPath + "/" + file).isDirectory()) {
      arrayOfFiles = getAllFiles(dirPath + "/" + file, originalPath, arrayOfFiles)
    } else {
      file = path.join(dirPath, "/", file)

      arrayOfFiles.push({
        path: path.relative(originalPath, file).replace(/\\/g, "/"),
        content: fs.readFileSync(file),
        mtime: fs.statSync(file).mtime
      })
    }
  })

  return arrayOfFiles
}

function getAllFiles(dirPath, originalPath, arrayOfFiles) {
  files = fs.readdirSync(dirPath)

  arrayOfFiles = arrayOfFiles || []
  originalPath = originalPath || path.resolve(dirPath, "..")

  folder = path.relative(originalPath, path.join(dirPath, "/"))

  arrayOfFiles.push({
    path: folder.replace(/\\/g, "/"),
    mtime: fs.statSync(originalPath + "/" + folder).mtime
  })

  files.forEach(function (file) {
    if (fs.statSync(dirPath + "/" + file).isDirectory()) {
      arrayOfFiles = getAllFiles(dirPath + "/" + file, originalPath, arrayOfFiles)
    } else {
      file = path.join(dirPath, "/", file)

      arrayOfFiles.push({
        path: path.relative(originalPath, file).replace(/\\/g, "/"),
        content: fs.readFileSync(file),
        mtime: fs.statSync(file).mtime
      })
    }
  })

  return arrayOfFiles
}

async function run() {
  files = getAllFiles(process.argv[2])

  ipfs = ipfsClient.create(process.argv[3])

  for await (const result of ipfs.addAll(files, { pin: true, })) {
    console.log(result);
  }
}

run()
