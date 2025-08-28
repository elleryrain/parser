import { Browser, Page } from "puppeteer";
import { delay } from "../../utils/delay";
import { groupUrl } from "../../config/envConfig";
import fs from "node:fs";
import path from "node:path";
import { generateVkPostLink } from "../../utils/links";
import { linksJsonPath, postsDir } from "../../config/consts";

interface PostLink {
  postId: string;
  url: string;
  parsed: boolean;
}

export class Link {
  static async autoScroll(page: Page): Promise<boolean> {
    const previousHeight = (await page.evaluate(
      "document.body.scrollHeight"
    )) as number;
    await page.evaluate("window.scrollTo(0, document.body.scrollHeight)");
    await delay(2000);

    const currentHeight = (await page.evaluate(
      "document.body.scrollHeight"
    )) as number;
    return currentHeight > previousHeight;
  }

  static async getLinks(
    browser: Browser,
    page: Page,
    intervalMs: number = 4500
  ) {
    await page.goto(groupUrl);
    let previousPostIds: string[] = [];

    if (!fs.existsSync(linksJsonPath)) {
      fs.writeFileSync(linksJsonPath, JSON.stringify([], null, 2));
      console.log(`Создан файл ${linksJsonPath}`);
    }

    const intervalId = setInterval(async () => {
      try {
        const hasScrolled = await this.autoScroll(page);

        const data = await page.evaluate(() => {
          const posts = document.querySelectorAll(".post");
          const postsData: string[] = [];
          for (let i of posts) {
            const postId = i.getAttribute("id") as string;
            postsData.push(postId);
          }
          return postsData;
        });

        console.log(`Получено ${data.length} постов`);

        const links: PostLink[] = JSON.parse(
          fs.readFileSync(linksJsonPath, { encoding: "utf-8" })
        );

        const newPosts = data.filter(
          (postId) => !previousPostIds.includes(postId)
        );
        if (newPosts.length > 0) {
          for (const postIdDirty of newPosts) {
            const postIdFormatted = postIdDirty.slice(5);
            const postDir = path.join(postsDir, postIdFormatted);

            if (!fs.existsSync(postDir)) {
              fs.mkdirSync(postDir, { recursive: true });
              console.log(`Создана папка для поста ${postIdDirty}: ${postDir}`);
            } else {
              console.log(`Папка для поста ${postIdDirty} уже существует`);
            }

            // Проверка, есть ли пост в JSON
            if (!links.some((link) => link.postId === postIdFormatted)) {
              links.push({
                postId: postIdFormatted,
                url: generateVkPostLink(postIdFormatted),
                parsed: false,
              });
              console.log(
                `Добавлена ссылка для поста ${postIdDirty}: ${generateVkPostLink(
                  postIdFormatted
                )}`
              );
            }
          }

          // Сохранение обновленного JSON
          fs.writeFileSync(linksJsonPath, JSON.stringify(links, null, 2));
        } else {
          console.log("Новых постов не найдено");
        }

        // Обновляем список предыдущих постов
        previousPostIds = [...data];

        // Остановка, если прокрутка не добавила новую высоту
        if (!hasScrolled) {
          console.log(
            "Прокрутка завершена, новых данных нет, остановка интервала"
          );
          clearInterval(intervalId);
          await browser.close();
        }
      } catch (err) {
        console.error("Ошибка в процессе прокрутки или сбора данных:", err);
        clearInterval(intervalId);
        await browser.close();
      }
    }, intervalMs);
  }
}
