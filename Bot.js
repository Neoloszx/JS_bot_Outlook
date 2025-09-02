import puppeteer from "puppeteer-core";
import fs from "fs";
import path from "path";


// **************************************************** ปรับค่า EMAIL + PASSWD ****************************************************
const input_Email = "camemb.gva@mfaic.gov.kh";
const input_Passwd = "Mfaic@2022";
// **************************************************** ****************************************************


const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function getXPathElement(page, xpath) {
  return await page.evaluateHandle((xp) => {
    const result = document.evaluate(
      xp,
      document,
      null,
      XPathResult.ORDERED_NODE_SNAPSHOT_TYPE,
      null
    );
    if (result.snapshotLength > 0) {
      return result.snapshotItem(result.snapshotLength - 1);
    }
    return null;
  }, xpath);
}

async function clickXPath(page, xpath, debugName = "unknown") {
  console.log(`🔎 [DEBUG] กำลังหา element ด้วย XPath: ${xpath}`);
  const handle = await getXPathElement(page, xpath);
  if (handle) {
    const el = handle.asElement();
    if (el) {
      await page.evaluate((el) => {
        el.scrollIntoView({ behavior: "auto", block: "center" });
      }, el);

      console.log(`✅ [DEBUG] เจอ element (${debugName}) → กำลังกดคลิก`);
      await page.evaluate((el) => el.click(), el);
      return true;
    }
  }
  console.log(`❌ [DEBUG] ไม่เจอ element (${debugName})`);
  return false;
}

async function run() {
  const browser = await puppeteer.launch({
    headless: false,
    args: ["--no-sandbox",
    "--disable-gpu",
    "--disable-dev-shm-usage",
    "--enable-features=NetworkService,NetworkServiceInProcess",
    "--disable-popup-blocking"
 
    ],
    executablePath: "/usr/bin/chromium"
  });

  const [page] = await browser.pages();
  await page.setViewport({ width: 1280, height: 800 });


 
// **************************************************** ปรับค่า Path Download ที่นี่ ****************************************************
  const downloadPath = path.resolve("./downloads/Attachment");
  const debugPath = path.resolve("./debug-screens");
  const pdfPath_origin = path.resolve("./downloads");
  fs.mkdirSync(downloadPath, { recursive: true });
  fs.mkdirSync(debugPath, { recursive: true });

// **************************************************** ****************************************************
  
  
  
  
  // Login
  // **************************************************** ปรับค่า URL********************************************************
  await page.goto("https://mail.mfaic.gov.kh/");
//************************************************************************************************************
  await page.waitForSelector('input[id="username"]');
  await page.type('input[id="username"]', input_Email);
  await page.type('input[id="password"]', input_Passwd);
  await page.click(".signinTxt");
  await page.waitForNavigation();

  const ncount_inbox = await page.$$('div[role="option"]');
  console.log(`เจออีเมลทั้งหมด: ${ncount_inbox.length} ฉบับ`);

  for (let i = 0; i < ncount_inbox.length; i++) {
    // Query inbox ใหม่ทุกครั้ง
    const freshInbox = await page.$$('div[role="option"]');
    if (!freshInbox[i]) continue;

    console.log(`\n📧 กำลังโหลดอีเมลลำดับที่ ${i + 1}/${freshInbox.length}`);
    await freshInbox[i].click();
    await page.waitForSelector('div[aria-label="Message Contents"]', { timeout: 15000 });
    
	//Fetch Titile
	// ใช้ querySelector
	const Title_name = await page.$eval(
	"span.rpHighlightAllClass.rpHighlightSubjectClass",
	el => el.innerText.trim()
	);
	// ล้างชื่อไฟล์ให้ปลอดภัย (ตัดอักขระที่ผิดกฎหมายออก)
	const safeTitle = Title_name.replace(/[<>:"/\\|?*]+/g, "").replace(/\s+/g, "_");


    const ncount_inside_inbox = await page.$$('[aria-label="Message Contents"]');
    console.log("จำนวนข้อความ/การโต้ตอบภายในอีเมล:", ncount_inside_inbox.length);

    for (let j = 0; j < ncount_inside_inbox.length; j++) {
      // Query message contents สดทุกครั้ง
      const fresh_inside = await page.$$('[aria-label="Message Contents"]');
      if (!fresh_inside[j]) continue;

      console.log(`\n🔓 กำลังเปิดข้อความที่ ${j + 1}/${ncount_inside_inbox.length}`);
      await fresh_inside[j].click();
      
      try{
      await page.waitForSelector('div[aria-label="Message Contents"]', { timeout: 15000 });
      }
      
      catch(err){
      console.log(`⚠️ ไม่พบ message content หลังคลิก j=${j}, ข้ามไป`);
      continue;
      }
      
      	// ให้ safeTitle เป็น subfolder
	const saveDir = path.join(pdfPath_origin, safeTitle);

	// ✅ สร้างโฟลเดอร์ก่อน (recursive ให้สร้าง subfolder ได้)
	await fs.promises.mkdir(saveDir, { recursive: true })
      	// สั่งให้ Chromium อนุญาต multiple downloads โดยอัตโนมัติ
	const client = await page.target().createCDPSession();
	await client.send("Page.setDownloadBehavior", {
	behavior: "allow",
	downloadPath: saveDir
	});


      // --- Refresh Download / Download_all ---
      let foundDownloadAll = false;
      let foundDownloadOne = false;

      // Download All
      if (await clickXPath(page, "//span[contains(text(), 'Download all')]", "Download All")) {
        foundDownloadAll = true;
        console.log("📥 คลิก Download All");
      }

      // Download Single
      if (await clickXPath(page, "//span[contains(text(), 'Download')]", "Download Single")) {
        foundDownloadOne = true;
        console.log("📥 คลิก Download Single");
      }

      if (!foundDownloadAll && !foundDownloadOne) {
        console.log("ℹ️ ไม่พบปุ่ม Download");
      }

      //เปิดแท็บใหม่แล้ว Print
        const container = await fresh_inside[j];
	if (container) {
	  const htmlContent = await page.evaluate(el => el.outerHTML, container);

	  // เปิดแท็บใหม่สำหรับ export PDF
	  const pdfPage = await browser.newPage();
	  await pdfPage.setContent(`
	    <html>
	      <head>
		<meta charset="utf-8"/>
		<style>
		  body { font-family: sans-serif; }
		</style>
	      </head>
	      <body>${htmlContent}</body>
	    </html>
	  `, { waitUntil: 'networkidle0' });
	  
	  await delay(6000);
	  

	
	const pdfPath = path.join(saveDir,`email-${i + 1}-${j + 1}-${Date.now()}.pdf`);
	
	
	  await pdfPage.pdf({
	    path: pdfPath,
	    format: "A4",
	    printBackground: true
	  });
	  console.log(`✅ บันทึก message ${i+1}-${j+1} → ${pdfPath}`);
	  await pdfPage.close();
	}


        await clickXPath(page, "//span[normalize-space(text())='Cancel']", "Close Print Window");
        await delay(2000);
      }
    }
  }


run();
