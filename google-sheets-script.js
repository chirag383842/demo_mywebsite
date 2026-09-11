/**
 * Google Apps Script for Paras Kachoriwala Customer Feedback Sync
 * 
 * Instructions:
 * 1. Open your Google Sheet (https://sheets.new or open your existing sheet).
 * 2. Note: You can name your tab "Feedback" or "Sheet1" (or keep whatever name you have).
 * 3. In the top menu of Google Sheets, click: Extensions > Apps Script
 * 4. Replace all code in the editor with this script.
 * 5. Click "Save" (disk icon).
 * 6. Click "Deploy" (top right) > "Manage deployments" (or "New deployment").
 *    - If editing: click the Pencil (edit) icon, select "New version", and click Deploy.
 *    - If new: click "New deployment", select type "Web app", set:
 *        - Description: Paras Feedback Webhook
 *        - Execute as: Me
 *        - Who has access: Anyone
 * 7. Click "Deploy", authorize access when prompted.
 * 8. Copy the Web App URL (starts with https://script.google.com/macros/s/.../exec).
 * 9. Paste that URL into .env (VITE_GOOGLE_SHEETS_URL=...) or in the website's Admin Portal.
 */

function getTargetSheet() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  
  // 1. Check for tab named "Feedback"
  var sheet = ss.getSheetByName("Feedback");
  if (sheet) return sheet;

  // 2. Check for tab named "Sheet1" or "Sheet 1"
  sheet = ss.getSheetByName("Sheet1") || ss.getSheetByName("Sheet 1");
  if (sheet) return sheet;

  // 3. Check active sheet
  sheet = ss.getActiveSheet();
  if (sheet) return sheet;

  // 4. If all else fails, create "Feedback" tab automatically
  return ss.insertSheet("Feedback");
}

function ensureHeaders(sheet) {
  if (sheet.getLastRow() === 0) {
    sheet.appendRow([
      "Timestamp",
      "Record ID",
      "Customer Name",
      "Overall Rating",
      "Food Rating",
      "Service Rating",
      "Cleanliness Rating",
      "Feedback Message"
    ]);
    var headerRange = sheet.getRange(1, 1, 1, 8);
    headerRange.setFontWeight("bold");
    headerRange.setBackground("#9c4c18");
    headerRange.setFontColor("#ffffff");
    return;
  }

  // Migrate the previous seven-column layout without deleting existing reviews.
  var headers = sheet.getRange(1, 1, 1, Math.max(sheet.getLastColumn(), 1)).getDisplayValues()[0];
  if (headers.indexOf("Record ID") === -1) {
    sheet.insertColumnBefore(2);
    sheet.getRange(1, 2).setValue("Record ID");
    sheet.getRange(1, 2).setFontWeight("bold");
    sheet.getRange(1, 2).setBackground("#9c4c18");
    sheet.getRange(1, 2).setFontColor("#ffffff");
  }
}

function parsePayload(e) {
  var data = {};
  if (!e) return data;

  if (e.postData && e.postData.contents) {
    try {
      data = JSON.parse(e.postData.contents);
    } catch (err) {
      // Fallback if contents is URL-encoded string
      if (typeof e.postData.contents === 'string') {
        var pairs = e.postData.contents.split('&');
        pairs.forEach(function(pair) {
          var kv = pair.split('=');
          if (kv.length === 2) {
            data[decodeURIComponent(kv[0])] = decodeURIComponent(kv[1].replace(/\+/g, ' '));
          }
        });
      }
    }
  }

  if (Object.keys(data).length === 0 && e.parameter) {
    data = e.parameter;
  }

  return data;
}

function recordFeedback(data) {
  var lock = LockService.getScriptLock();
  try {
    lock.waitLock(10000);
  } catch (e) {
    // If lock times out, continue with best effort
  }

  try {
    var sheet = getTargetSheet();
    ensureHeaders(sheet);

    var recordId = String(data.record_id || data.recordId || "").trim();
    var timestamp = data.timestamp || new Date().toLocaleString("en-IN", { timeZone: "Asia/Kolkata" });
    var customerName = data.customer_name || data.customerName || "Anonymous Customer";
    var overallRating = Number(data.overall_rating || data.overallRating || 5);
    var foodRating = Number(data.food_rating || data.foodRating || 0);
    var serviceRating = Number(data.service_rating || data.serviceRating || 0);
    var cleanlinessRating = Number(data.cleanliness_rating || data.cleanlinessRating || 0);
    var message = data.message || data.feedback || "";
    var fingerprint = [customerName, overallRating, foodRating, serviceRating, cleanlinessRating, message]
      .join("|")
      .toLowerCase()
      .trim();

    // Idempotency: retries and Save Link & Sync Reviews must never create duplicates.
    if (sheet.getLastRow() > 1) {
      var existingRows = sheet.getRange(2, 2, sheet.getLastRow() - 1, 7).getDisplayValues();
      for (var i = 0; i < existingRows.length; i++) {
        var existingId = String(existingRows[i][0]).trim();
        var existingFingerprint = [existingRows[i][1], existingRows[i][2], existingRows[i][3], existingRows[i][4], existingRows[i][5], existingRows[i][6]]
          .join("|")
          .toLowerCase()
          .trim();
        if ((recordId && existingId === recordId) || ((!recordId || !existingId) && existingFingerprint === fingerprint)) {
          return {
            status: "duplicate",
            message: "Feedback already exists; duplicate skipped.",
            sheet: sheet.getName(),
            record_id: recordId
          };
        }
      }
    }

    sheet.appendRow([
      timestamp,
      recordId,
      customerName,
      overallRating,
      foodRating,
      serviceRating,
      cleanlinessRating,
      message
    ]);

    return {
      status: "success",
      message: "Feedback recorded successfully in sheet: " + sheet.getName(),
      sheet: sheet.getName(),
      timestamp: timestamp
    };
  } finally {
    try {
      lock.releaseLock();
    } catch (e) {}
  }
}

function doPost(e) {
  try {
    var data = parsePayload(e);
    var result = recordFeedback(data);

    return ContentService.createTextOutput(JSON.stringify(result))
      .setMimeType(ContentService.MimeType.JSON);
  } catch (error) {
    return ContentService.createTextOutput(JSON.stringify({
      status: "error",
      message: error.toString()
    })).setMimeType(ContentService.MimeType.JSON);
  }
}

function doGet(e) {
  // If query parameters are present, allow recording feedback via GET as fallback
  if (e && e.parameter && (e.parameter.overall_rating || e.parameter.message)) {
    try {
      var result = recordFeedback(e.parameter);
      return ContentService.createTextOutput(JSON.stringify(result))
        .setMimeType(ContentService.MimeType.JSON);
    } catch (err) {
      return ContentService.createTextOutput(JSON.stringify({ status: "error", message: err.toString() }))
        .setMimeType(ContentService.MimeType.JSON);
    }
  }

  return ContentService.createTextOutput(JSON.stringify({
    status: "success",
    message: "Paras Kachoriwala Google Sheets Feedback Service is Live and Ready!"
  })).setMimeType(ContentService.MimeType.JSON);
}
