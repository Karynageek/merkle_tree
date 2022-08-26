import download from "download";
import fs from "fs";
import readline from 'readline';

type NftImage = {
    id: number,
    size: number
};

function printProgress(progress: string) {
    readline.cursorTo(process.stdout, 0);
    process.stdout.write(progress);
}

async function main() {
    const sizes: NftImage[] = [];
    console.log();
    for (let i = 1; i <= 10005; i++) {
        const folder = `img`;
        const filePath = `${folder}/${i}.webp`;
        const url = `https://upload-ww.mypinata.cloud/ipfs/QmUmTsMyDEdgk6jVhZJwB9ke1rEFtJZgytHyqMivVudqsa/${i}.webp`;

        try {
            await download(url, folder);
        } catch (error) {
            console.log();
            console.log("!!! Something is wrong with file", i);
            console.log();
            continue;
        }

        var stats = fs.statSync(filePath);
        var fileSizeInBytes = stats.size;

        sizes.push({
            id: i,
            size: fileSizeInBytes
        });

        printProgress(`Checking image id ${i}, size is ${fileSizeInBytes}`);
    }
    console.log();
    fs.writeFile('sizes.json', JSON.stringify(sizes, null, 4), function (err) {
        if (err) return console.log(err);
        console.log('Write done');
    });
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
