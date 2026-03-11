import fs from "node:fs";

const updateServiceWorker = (manifestName: string) => {
  // service worker file path
  const swFilePath = "./build/client/sw.js";
  // read current service worker content
  fs.readFile(
    swFilePath,
    "utf8",
    (err: NodeJS.ErrnoException | null, data: string) => {
      if (err) {
        console.error(err);
      } else {
        // check if script has already been run
        if (
          data.includes('{url:"index.html",') ||
          data.includes('{url:"assets/manifest-')
        ) {
          console.log("sw.js already updated - no changes made");
        } else {
          // use timestamp as file revision for index.html
          // the other missing file already has a revision built ino the name
          // so the revision for that is null
          const indexRevision: string = new Date().getTime().toString();
          const insert1: string =
            '{url:"index.html",revision:"' + indexRevision + '"}';
          const insert2: string =
            '{url:"assets/' + manifestName + '",revision:null}';
          // add the missing files to precache list at the start (position doesn't matter)
          data = data.replace(
            "s.precacheAndRoute([",
            "s.precacheAndRoute([" + insert1 + "," + insert2 + ",",
          );
          if (data.includes(insert1) && data.includes(insert2)) {
            // update the file
            fs.writeFile(
              swFilePath,
              data,
              (err: NodeJS.ErrnoException | null) => {
                if (err) {
                  console.error(err);
                } else {
                  console.log("Service Worker updated!");
                }
              },
            );
          } else {
            console.log(
              "failed to update service worker - insert point not found!",
            );
          }
        }
      }
    },
  );
};

// name of manifest js file that did not get auto added to the precache files list
fs.readdir(
  "./build/client/assets",
  (err: NodeJS.ErrnoException | null, files: string[]) => {
    if (err) {
      console.error(err);
    } else {
      let manifestName: string = "";
      const fileCount = files.length;
      let fileNo: number = 0;
      while (fileNo < fileCount && manifestName === "") {
        const filename: string = files[fileNo];
        if (filename.startsWith("manifest-")) {
          manifestName = filename;
          updateServiceWorker(manifestName);
          console.log(filename);
        }
        fileNo += 1;
      }
    }
  },
);
