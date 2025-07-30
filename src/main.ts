import puppeteer, { Browser, Page } from "puppeteer";
import path from "node:path";
import fs from "node:fs";
import fsp from "node:fs/promises";
import { delay } from "./utils/delay";

import { authUrl, cookiesPath, postsDir } from "./config/consts";
import { groupUrl } from "./config/envConfig";
import { performAuthorization } from "./utils/auth";
import { setup } from "./utils/setup";

async function autoScroll(page) {
  let previousHeight = await page.evaluate("document.body.scrollHeight");
  let maxScrolls = 100;
  let scrollCount = 0;

  while (scrollCount < maxScrolls) {
    await page.evaluate("window.scrollTo(0, document.body.scrollHeight)");
    await delay(2000);

    let currentHeight = await page.evaluate("document.body.scrollHeight");
    if (currentHeight > previousHeight) {
      previousHeight = currentHeight;
      scrollCount++;
    } else {
      break;
    }
  }
}

async function main() {
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
  console.log(cookiesData);

  await browser.setCookie(...cookiesData);

  await page.goto(groupUrl);
  autoScroll(page);
  setInterval(async () => {
    const data = await page.evaluate(() => {
      const posts = document.querySelectorAll(".post");
      const postsData: Record<string, { postDescription: string }> = {};
      for (let i of posts) {
        const postDescription = i.querySelector(".wall_post_text_wrapper")
          ?.textContent as string;
        console.log("atttr");
        const postId = i.getAttribute("id") as string;
        postsData[postId] = {
          postDescription,
        };
      }
      return postsData;
    });
    console.log("data", data);

    for (const postId in data) {
      const postDir = path.join(postsDir, postId);

      if (!fs.existsSync(postDir)) {
        fs.mkdirSync(postDir, { recursive: true });
        console.log(`Создана папка для поста ${postId}`);
      }

      const descriptionFile = path.join(postDir, "description.txt");

      fs.writeFileSync(descriptionFile, data[postId].postDescription || "");
      console.log(`Сохранено описание для поста ${postId}`);
    }
  }, 15000);
}

main().catch((err) => {
  console.error(err);
});
