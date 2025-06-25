import fs from "node:fs"

const inp = fs.readFileSync("src/file-explorer.js", "utf8");
const svg = fs.readFileSync("src/svg/file-explorer.svg", 'base64');
const out = 'public/os-files/apps/file-explorer.wos';

const json = JSON.stringify({
	icons: {
		src: 'data:image/svg+xml;base64,' + svg,
	},
	js: inp,
})

fs.writeFileSync(out, json)