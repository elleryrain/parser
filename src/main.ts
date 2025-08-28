import puppeteer from "puppeteer";
import fs from "node:fs";
import fsp from "node:fs/promises";

import { cookiesPath, ETypeArgsParser } from "./config/consts";
import { performAuthorization } from "./utils/auth";
import { setup } from "./utils/setup";
import yargs from "yargs";
import { Link } from "./modules/link";
import { PostParser } from "./modules/post";

async function main() {
  const args = yargs(process.argv)
    .option("type", {
      alias: "type",
      type: "string",
    })
    .parseSync();
  console.log(args);
  let isCookiesReady = false;
  try {
    await fsp.access(cookiesPath);
    isCookiesReady = true;
    console.log("файл с cookies найден");
  } catch (err) {
    await fsp.writeFile(cookiesPath, "");
    console.log("файл с cookies создан");
  }
  await setup();
  const browser = await puppeteer.launch({ headless: false });
  const page = await browser.newPage();

  if (!isCookiesReady) {
    await performAuthorization(page, browser);
    await browser.close();
    return;
  }
  const cookiesData = JSON.parse(
    fs.readFileSync(cookiesPath, { encoding: "utf-8" })
  );

  await browser.setCookie(...cookiesData);
  console.log(args.type);
  if (args.type === ETypeArgsParser.getPosts) {
    await Link.getLinks(browser, page);
  }
  if (args.type === ETypeArgsParser.parsePosts) {
    await PostParser.parsePosts(browser, page);
  }
}

main().catch((err) => {
  console.error(err);
});
