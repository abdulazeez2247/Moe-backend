const slugify = require("slugify");
const puppeteer = require("puppeteer");
const path = require("path");
const fs = require("fs").promises;

const generateSlug = (text, platform, version) => {
  const baseSlug = slugify(text, {
    lower: true,
    strict: true,
    remove: /[*+~.()'"!:@]/g,
  });
  const platformSlug = slugify(platform, { lower: true, strict: true });
  const versionSlug = version
    ? slugify(version, { lower: true, strict: true })
    : "generic";
  return `${platformSlug}/${versionSlug}/${baseSlug}`;
};

const generateSEOMeta = (question, answer, platform, version) => {
  const cleanAnswer = answer.replace(/[#*`]/g, "").substring(0, 160).trim();
  const title = `How to ${question} in ${platform} ${version || ""} | Moe`;
  const description = `Learn how to ${question}. ${cleanAnswer}... Expert guide from Moe.`;

  return {
    seoTitle: title,
    seoDescription: description,
    publishedUrl: generateSlug(question, platform, version),
  };
};

const generateSocialImage = async (title, outputPath) => {
  const htmlContent = `
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="UTF-8">
        <style>
            body { 
                font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif; 
                background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                color: white;
                padding: 4rem;
                margin: 0;
                height: 100vh;
                display: flex;
                align-items: center;
                justify-content: center;
                box-sizing: border-box;
            }
            .container { 
                max-width: 800px; 
                text-align: center;
            }
            h1 { 
                font-size: 3rem; 
                margin-bottom: 1rem;
                text-shadow: 2px 2px 4px rgba(0,0,0,0.2);
                line-height: 1.2;
            }
            .logo { 
                font-size: 2rem; 
                font-weight: bold; 
                opacity: 0.8; 
                margin-top: 2rem;
            }
        </style>
    </head>
    <body>
        <div class="container">
            <h1>${title}</h1>
            <div class="logo">Just Ask Moe</div>
        </div>
    </body>
    </html>
    `;

  let browser;
  try {
    const dir = path.dirname(outputPath);
    await fs.mkdir(dir, { recursive: true });

    browser = await puppeteer.launch({
      args: ["--no-sandbox", "--disable-setuid-sandbox"],
    });
    const page = await browser.newPage();
    await page.setViewport({ width: 1200, height: 630, deviceScaleFactor: 1 });
    await page.setContent(htmlContent, { waitUntil: "networkidle0" });
    await page.screenshot({ path: outputPath, type: "jpeg", quality: 90 });
    await browser.close();
  } catch (error) {
    if (browser) await browser.close();
    console.error("Failed to generate social image:", error);
    throw error;
  }
};

module.exports = { generateSEOMeta, generateSocialImage, generateSlug };
