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
  static async autoScroll(
    page: Page,
    maxAttempts: number = 4
  ): Promise<boolean> {
    let attempts = 0;
    let previousHeight = await page.evaluate("document.body.scrollHeight");

    while (attempts < maxAttempts) {
      // Проверка, что страница активна
      console.log("попытки:", attempts);
      if (page.isClosed()) {
        console.log("Страница закрыта, прекращаем прокрутку");
        return false;
      }

      await page.evaluate("window.scrollTo(0, document.body.scrollHeight)");
      await delay(4500);

      const currentHeight = await page.evaluate("document.body.scrollHeight");
      if (currentHeight === previousHeight) {
        console.log(
          `Прокрутка завершена после ${
            attempts + 1
          } попыток: новая высота не появилась`
        );
      } else {
        attempts = 0;
      }

      previousHeight = currentHeight;
      attempts++;
      console.log(`Прокрутка ${attempts}/${maxAttempts}`);
    }

    console.log(
      `Достигнуто максимальное количество попыток прокрутки (${maxAttempts})`
    );
    return false;
  }

  static async getLinks(
    browser: Browser,
    page: Page,
    intervalMs: number = 4500,
    maxPosts: number = 10000
  ) {
    try {
      await page.goto(groupUrl);

      if (!fs.existsSync(linksJsonPath)) {
        fs.writeFileSync(linksJsonPath, JSON.stringify([], null, 2));
        console.log(`Создан файл ${linksJsonPath}`);
      }

      let previousPostIds: string[] = [];
      let continueScrolling = true;

      while (continueScrolling) {
        try {
          if (page.isClosed()) {
            console.log("Страница закрыта, завершаем сбор ссылок");
            break;
          }

          continueScrolling = await this.autoScroll(page);

          const data = await page.evaluate(() => {
            const posts = document.querySelectorAll(".post");
            const postsData: string[] = [];
            for (const post of posts) {
              const postId = post.getAttribute("id") as string;
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
                console.log(
                  `Создана папка для поста ${postIdDirty}: ${postDir}`
                );
              } else {
                console.log(`Папка для поста ${postIdDirty} уже существует`);
              }

              // Добавление новой ссылки
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

          // Обновление списка предыдущих постов
          previousPostIds = [...data];

          // Проверка ограничения по количеству постов
          if (links.length >= maxPosts) {
            console.log(
              `Достигнуто максимальное количество постов (${maxPosts})`
            );
            continueScrolling = false;
          }

          // Задержка перед следующей итерацией
          if (continueScrolling) {
            await delay(intervalMs);
          }
        } catch (err) {
          console.error("Ошибка в процессе прокрутки или сбора данных:", err);
          continueScrolling = false;
        }
      }

      console.log("Сбор ссылок завершен");
      await browser.close();
    } catch (err) {
      console.error("Ошибка при загрузке страницы или сборе ссылок:", err);
      await browser.close();
    }
  }
}
