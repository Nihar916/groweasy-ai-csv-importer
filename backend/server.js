const express = require("express");
const cors = require("cors");
const multer = require("multer");
const csv = require("csv-parser");
const fs = require("fs");
const path = require("path");
const dotenv = require("dotenv");
const { GoogleGenAI } = require("@google/genai");

dotenv.config({
  path: path.join(__dirname, ".env"),
  override: true,
});

const GEMINI_API_KEY = String(
  process.env.GEMINI_API_KEY || ""
).trim();

const app = express();
const PORT = process.env.PORT || 5000;

const ai = GEMINI_API_KEY
  ? new GoogleGenAI({
      apiKey: GEMINI_API_KEY,
    })
  : null;

app.use(cors());
app.use(express.json());

const uploadDirectory = "/tmp/uploads";

if (!fs.existsSync(uploadDirectory)) {
  fs.mkdirSync(uploadDirectory, {
    recursive: true,
  });
}

const upload = multer({
  dest: uploadDirectory,
  limits: {
    fileSize: 10 * 1024 * 1024,
  },
});

const CRM_FIELDS = [
  "created_at",
  "name",
  "email",
  "country_code",
  "mobile_without_country_code",
  "company",
  "city",
  "state",
  "country",
  "lead_owner",
  "crm_status",
  "crm_note",
  "data_source",
  "possession_time",
  "description",
];

const ALLOWED_CRM_STATUSES = [
  "GOOD_LEAD_FOLLOW_UP",
  "DID_NOT_CONNECT",
  "BAD_LEAD",
  "SALE_DONE",
];

const ALLOWED_DATA_SOURCES = [
  "leads_on_demand",
  "meridian_tower",
  "eden_park",
  "varah_swamy",
  "sarjapur_plots",
];

const EMAIL_HEADER_ALIASES = [
  "email",
  "email address",
  "email id",
  "emailid",
  "contact email",
  "contactemail",
  "lead email",
  "leademail",
  "customer email",
  "customeremail",
  "client email",
  "clientemail",
  "primary email",
  "primaryemail",
  "mail",
];

const PHONE_HEADER_ALIASES = [
  "phone",
  "phone number",
  "phonenumber",
  "mobile",
  "mobile number",
  "mobilenumber",
  "contact number",
  "contactnumber",
  "contact phone",
  "contactphone",
  "whatsapp",
  "whatsapp number",
  "whatsappnumber",
  "whats app number",
  "lead phone",
  "leadphone",
  "lead mobile",
  "leadmobile",
  "customer phone",
  "customerphone",
  "customer mobile",
  "customermobile",
  "client phone",
  "clientphone",
  "client mobile",
  "clientmobile",
  "primary phone",
  "primaryphone",
  "primary mobile",
  "primarymobile",
  "telephone",
  "tel",
];

app.get("/", (req, res) => {
  res.json({
    success: true,
    message: "GrowEasy AI CSV Importer Backend is running",
  });
});

function cleanText(value) {
  if (value === null || value === undefined) {
    return "";
  }

  return String(value)
    .replace(/\r?\n/g, "\\n")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeKey(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
}

function normalizeAliasList(aliases) {
  return aliases.map(normalizeKey);
}

const NORMALIZED_EMAIL_HEADERS =
  normalizeAliasList(EMAIL_HEADER_ALIASES);

const NORMALIZED_PHONE_HEADERS =
  normalizeAliasList(PHONE_HEADER_ALIASES);

function isEmailHeader(header) {
  const key = normalizeKey(header);

  return NORMALIZED_EMAIL_HEADERS.includes(key);
}

function isPhoneHeader(header) {
  const key = normalizeKey(header);

  return NORMALIZED_PHONE_HEADERS.includes(key);
}

function getContactFieldValues(record, matcher) {
  const values = [];

  for (const [header, value] of Object.entries(
    record || {}
  )) {
    if (matcher(header)) {
      const cleanedValue = cleanText(value);

      if (cleanedValue) {
        values.push(cleanedValue);
      }
    }
  }

  return values;
}

function extractEmailsFromText(value) {
  const text = cleanText(value);

  const matches =
    text.match(
      /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi
    ) || [];

  return [
    ...new Set(
      matches.map((email) =>
        email.toLowerCase()
      )
    ),
  ];
}

function extractPhonesFromText(value) {
  const text = cleanText(value);

  if (!text) {
    return [];
  }

  const matches =
    text.match(
      /(?:\+\d{1,3}[\s\-()]*)?(?:\d[\s\-()]*){7,15}/g
    ) || [];

  const phones = [];

  for (const match of matches) {
    const digits = match.replace(/\D/g, "");

    if (
      digits.length >= 7 &&
      digits.length <= 15
    ) {
      phones.push({
        raw: cleanText(match),
        digits,
        hasPlus: match.trim().startsWith("+"),
      });
    }
  }

  const seen = new Set();

  return phones.filter((phone) => {
    if (seen.has(phone.digits)) {
      return false;
    }

    seen.add(phone.digits);
    return true;
  });
}

function getContactEvidence(record) {
  const emailValues = getContactFieldValues(
    record,
    isEmailHeader
  );

  const phoneValues = getContactFieldValues(
    record,
    isPhoneHeader
  );

  const emails = [];

  for (const value of emailValues) {
    emails.push(...extractEmailsFromText(value));
  }

  const phones = [];

  for (const value of phoneValues) {
    phones.push(...extractPhonesFromText(value));
  }

  const uniqueEmails = [...new Set(emails)];

  const seenPhones = new Set();

  const uniquePhones = phones.filter((phone) => {
    if (seenPhones.has(phone.digits)) {
      return false;
    }

    seenPhones.add(phone.digits);
    return true;
  });

  return {
    emails: uniqueEmails,
    phones: uniquePhones,
  };
}

function isValidLead(record) {
  const evidence = getContactEvidence(record);

  return (
    evidence.emails.length > 0 ||
    evidence.phones.length > 0
  );
}

function findValue(record, aliases) {
  const normalizedAliases =
    aliases.map(normalizeKey);

  for (const [header, value] of Object.entries(
    record || {}
  )) {
    const normalizedHeader =
      normalizeKey(header);

    if (
      normalizedAliases.includes(
        normalizedHeader
      )
    ) {
      const cleanedValue = cleanText(value);

      if (cleanedValue) {
        return cleanedValue;
      }
    }
  }

  return "";
}

function titleCase(value) {
  return cleanText(value)
    .toLowerCase()
    .replace(/\b\w/g, (character) =>
      character.toUpperCase()
    );
}

function normalizeDate(value) {
  const text = cleanText(value);

  if (!text) {
    return "";
  }

  const isoDate = new Date(text);

  if (!Number.isNaN(isoDate.getTime())) {
    return isoDate.toISOString();
  }

  const match = text.match(
    /^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})(?:\s+(\d{1,2}):(\d{2})(?::(\d{2}))?\s*(AM|PM)?)?$/i
  );

  if (!match) {
    return "";
  }

  let [
    ,
    day,
    month,
    year,
    hour = "0",
    minute = "0",
    second = "0",
    meridian = "",
  ] = match;

  let numericHour = Number(hour);

  if (
    meridian.toUpperCase() === "PM" &&
    numericHour < 12
  ) {
    numericHour += 12;
  }

  if (
    meridian.toUpperCase() === "AM" &&
    numericHour === 12
  ) {
    numericHour = 0;
  }

  const parsedDate = new Date(
    Number(year),
    Number(month) - 1,
    Number(day),
    numericHour,
    Number(minute),
    Number(second)
  );

  if (Number.isNaN(parsedDate.getTime())) {
    return "";
  }

  return parsedDate.toISOString();
}

function splitPhone(phone) {
  const digits = String(
    phone?.digits || ""
  ).replace(/\D/g, "");

  if (!digits) {
    return {
      country_code: "",
      mobile_without_country_code: "",
    };
  }

  if (
    phone?.hasPlus &&
    digits.length > 10
  ) {
    const countryCodeLength =
      digits.length - 10;

    if (
      countryCodeLength >= 1 &&
      countryCodeLength <= 3
    ) {
      return {
        country_code:
          "+" +
          digits.slice(0, countryCodeLength),
        mobile_without_country_code:
          digits.slice(countryCodeLength),
      };
    }
  }

  if (
    digits.length === 12 &&
    digits.startsWith("91")
  ) {
    return {
      country_code: "+91",
      mobile_without_country_code:
        digits.slice(2),
    };
  }

  return {
    country_code: "",
    mobile_without_country_code: digits,
  };
}

function emptyCRMRecord() {
  const result = {};

  for (const field of CRM_FIELDS) {
    result[field] = "";
  }

  return result;
}

function normalizeCRMStatus(value) {
  const text = cleanText(value);

  const exact = text
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");

  if (ALLOWED_CRM_STATUSES.includes(exact)) {
    return exact;
  }

  const lower = text.toLowerCase();

  if (
    lower.includes("sale done") ||
    lower.includes("deal closed") ||
    lower.includes("closed") ||
    lower.includes("converted") ||
    lower.includes("won")
  ) {
    return "SALE_DONE";
  }

  if (
    lower.includes("did not connect") ||
    lower.includes("not connect") ||
    lower.includes("no answer") ||
    lower.includes("busy") ||
    lower.includes("unreachable")
  ) {
    return "DID_NOT_CONNECT";
  }

  if (
    lower.includes("bad lead") ||
    lower.includes("not interested")
  ) {
    return "BAD_LEAD";
  }

  if (
    lower.includes("follow") ||
    lower.includes("good lead") ||
    lower.includes("reschedule") ||
    lower.includes("interested")
  ) {
    return "GOOD_LEAD_FOLLOW_UP";
  }

  return "";
}

function normalizeDataSource(value) {
  const text = cleanText(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");

  if (ALLOWED_DATA_SOURCES.includes(text)) {
    return text;
  }

  return "";
}

function buildLocalRecord(record) {
  const result = emptyCRMRecord();

  const evidence = getContactEvidence(record);

  const primaryEmail =
    evidence.emails[0] || "";

  const primaryPhone =
    evidence.phones[0] || null;

  const phoneParts = splitPhone(primaryPhone);

  result.created_at = normalizeDate(
    findValue(record, [
      "created_at",
      "created at",
      "lead created",
      "lead_created",
      "created",
      "created date",
      "lead date",
      "submission date",
      "timestamp",
      "date",
    ])
  );

  result.name = titleCase(
    findValue(record, [
      "name",
      "full name",
      "fullname",
      "full_name",
      "lead name",
      "lead_name",
      "customer name",
      "client name",
      "contact name",
    ])
  );

  result.email = primaryEmail;

  result.country_code =
    phoneParts.country_code;

  result.mobile_without_country_code =
    phoneParts.mobile_without_country_code;

  result.company = titleCase(
    findValue(record, [
      "company",
      "company name",
      "company_name",
      "business",
      "business name",
      "organization",
      "organisation",
    ])
  );

  result.city = titleCase(
    findValue(record, ["city", "town"])
  );

  result.state = titleCase(
    findValue(record, [
      "state",
      "province",
      "region",
    ])
  );

  result.country = titleCase(
    findValue(record, ["country"])
  );

  result.lead_owner = cleanText(
    findValue(record, [
      "lead owner",
      "lead_owner",
      "owner",
      "assigned to",
      "assigned_to",
      "sales owner",
      "agent",
    ])
  );

  result.crm_status = normalizeCRMStatus(
    findValue(record, [
      "crm status",
      "crm_status",
      "status",
      "lead status",
      "lead_status",
      "stage",
    ])
  );

  result.data_source = normalizeDataSource(
    findValue(record, [
      "data source",
      "data_source",
      "source",
      "lead source",
      "lead_source",
      "campaign",
      "campaign name",
      "project",
      "project name",
    ])
  );

  result.possession_time = cleanText(
    findValue(record, [
      "possession time",
      "possession_time",
      "possession",
      "property possession",
      "handover",
    ])
  );

  result.description = cleanText(
    findValue(record, [
      "description",
      "details",
      "additional description",
      "requirement",
      "requirements",
    ])
  );

  const notes = [];

  const originalNote = findValue(record, [
    "crm note",
    "crm_note",
    "note",
    "notes",
    "remark",
    "remarks",
    "comment",
    "comments",
    "follow up note",
    "followup note",
  ]);

  if (originalNote) {
    notes.push(originalNote);
  }

  if (evidence.emails.length > 1) {
    notes.push(
      `Additional emails: ${evidence.emails
        .slice(1)
        .join(", ")}`
    );
  }

  if (evidence.phones.length > 1) {
    notes.push(
      `Additional mobile numbers: ${evidence.phones
        .slice(1)
        .map((phone) => phone.raw)
        .join(", ")}`
    );
  }

  result.crm_note = notes.join(" | ");

  return result;
}

function buildAIPrompt(records) {
  return `
You are the GrowEasy CRM CSV extraction engine.

The input contains valid lead records from an arbitrary CSV.
Column names and CSV layouts are not fixed.

Map every input record into GrowEasy CRM format.

Return ONLY a valid JSON array.
Do not use markdown.
Do not add explanations.
Return exactly one output object for each input object.
Keep the same record order.

Never invent data.
Never copy values between records.
Never use a lead owner email as the lead email.
Never use dates, timestamps, IDs, postal codes, or numeric identifiers as mobile numbers.

Required fields:

{
  "created_at": "",
  "name": "",
  "email": "",
  "country_code": "",
  "mobile_without_country_code": "",
  "company": "",
  "city": "",
  "state": "",
  "country": "",
  "lead_owner": "",
  "crm_status": "",
  "crm_note": "",
  "data_source": "",
  "possession_time": "",
  "description": ""
}

AI EXTRACTION RULES:

1. created_at must be convertible using JavaScript new Date(created_at).

2. Extract the lead name into name.

3. email must contain the primary LEAD email only.

4. If multiple lead emails exist:
- use the first email in email
- append remaining emails into crm_note

5. Extract the primary LEAD mobile number.

6. country_code contains only the country code such as +91.

7. mobile_without_country_code contains only mobile digits without country code.

8. If multiple lead mobile numbers exist:
- use the first mobile
- append remaining mobile numbers into crm_note

9. Extract company or business into company.

10. Extract city, state and country separately.

11. lead_owner contains the owner or assigned salesperson information.

12. crm_status may ONLY be:
GOOD_LEAD_FOLLOW_UP
DID_NOT_CONNECT
BAD_LEAD
SALE_DONE

If status cannot be confidently mapped, return an empty string.

13. data_source may ONLY be:
leads_on_demand
meridian_tower
eden_park
varah_swamy
sarjapur_plots

If none match confidently, return an empty string.

14. crm_note is used for:
remarks
follow-up notes
additional comments
extra emails
extra mobile numbers
useful unmapped information

15. Extract possession time into possession_time.

16. Extract additional description or requirements into description.

17. Replace actual line breaks inside text with escaped \\n.

18. Never fabricate missing fields.

INPUT RECORDS:
${JSON.stringify(records)}
`;
}

function sanitizeAIRecord(
  aiRecord,
  originalRecord
) {
  const result = emptyCRMRecord();

  const localRecord =
    buildLocalRecord(originalRecord);

  const evidence =
    getContactEvidence(originalRecord);

  for (const field of CRM_FIELDS) {
    result[field] = cleanText(
      aiRecord?.[field]
    );
  }

  const aiEmail = result.email.toLowerCase();

  if (
    aiEmail &&
    evidence.emails.includes(aiEmail)
  ) {
    result.email = aiEmail;
  } else {
    result.email = localRecord.email;
  }

  const aiMobile = String(
    result.mobile_without_country_code || ""
  ).replace(/\D/g, "");

  const matchingPhone =
    evidence.phones.find((phone) => {
      return (
        phone.digits === aiMobile ||
        phone.digits.endsWith(aiMobile) ||
        aiMobile.endsWith(phone.digits)
      );
    });

  if (matchingPhone) {
    const phoneParts = splitPhone(matchingPhone);

    result.country_code =
      phoneParts.country_code;

    result.mobile_without_country_code =
      phoneParts.mobile_without_country_code;
  } else {
    result.country_code =
      localRecord.country_code;

    result.mobile_without_country_code =
      localRecord.mobile_without_country_code;
  }

  result.created_at =
    normalizeDate(result.created_at) ||
    localRecord.created_at;

  result.name =
    titleCase(result.name) ||
    localRecord.name;

  result.company =
    titleCase(result.company) ||
    localRecord.company;

  result.city =
    titleCase(result.city) ||
    localRecord.city;

  result.state =
    titleCase(result.state) ||
    localRecord.state;

  result.country =
    titleCase(result.country) ||
    localRecord.country;

  result.lead_owner =
    result.lead_owner ||
    localRecord.lead_owner;

  result.crm_status =
    normalizeCRMStatus(result.crm_status) ||
    localRecord.crm_status;

  result.data_source =
    normalizeDataSource(result.data_source) ||
    localRecord.data_source;

  result.possession_time =
    result.possession_time ||
    localRecord.possession_time;

  result.description =
    result.description ||
    localRecord.description;

  const notes = [];

  if (result.crm_note) {
    notes.push(result.crm_note);
  }

  if (
    localRecord.crm_note &&
    !notes.join(" ").includes(
      localRecord.crm_note
    )
  ) {
    notes.push(localRecord.crm_note);
  }

  result.crm_note = notes.join(" | ");

  return result;
}

async function processBatchWithAI(
  records,
  batchNumber
) {
  if (!ai) {
    return records.map(buildLocalRecord);
  }

  let lastError;

  for (let attempt = 1; attempt <= 2; attempt++) {
    try {
      console.log(
        `Processing AI batch ${batchNumber}, attempt ${attempt}`
      );

      const response =
        await ai.models.generateContent({
          model: "gemini-2.5-flash",
          contents: buildAIPrompt(records),
          config: {
            responseMimeType:
              "application/json",
            temperature: 0,
          },
        });

      if (!response.text) {
        throw new Error(
          "Gemini returned empty response"
        );
      }

      const parsed = JSON.parse(response.text);

      if (!Array.isArray(parsed)) {
        throw new Error(
          "AI response is not an array"
        );
      }

      if (parsed.length !== records.length) {
        throw new Error(
          "AI response record count mismatch"
        );
      }

      return parsed.map(
        (aiRecord, index) =>
          sanitizeAIRecord(
            aiRecord,
            records[index]
          )
      );
    } catch (error) {
      lastError = error;

      console.error(
        `AI batch ${batchNumber}, attempt ${attempt} failed:`,
        error.message
      );

      if (attempt < 2) {
        await new Promise((resolve) =>
          setTimeout(resolve, 2000)
        );
      }
    }
  }

  console.log(
    `Using deterministic fallback for batch ${batchNumber}`
  );

  console.error(
    "Final AI error:",
    lastError?.message
  );

  return records.map(buildLocalRecord);
}

async function processRecordsInBatches(records) {
  const BATCH_SIZE = 5;
  const importedRecords = [];

  for (
    let index = 0;
    index < records.length;
    index += BATCH_SIZE
  ) {
    const batch = records.slice(
      index,
      index + BATCH_SIZE
    );

    const batchNumber =
      Math.floor(index / BATCH_SIZE) + 1;

    const normalizedBatch =
      await processBatchWithAI(
        batch,
        batchNumber
      );

    importedRecords.push(
      ...normalizedBatch
    );
  }

  return importedRecords;
}

app.post(
  "/api/import",
  upload.single("file"),
  async (req, res) => {
    let uploadedFilePath = null;

    try {
      if (!req.file) {
        return res.status(400).json({
          success: false,
          error: "CSV file is required",
        });
      }

      const extension = path
        .extname(req.file.originalname)
        .toLowerCase();

      if (extension !== ".csv") {
        return res.status(400).json({
          success: false,
          error: "Only CSV files are allowed",
        });
      }

      uploadedFilePath = req.file.path;

      console.log("");
      console.log(
        "Received file:",
        req.file.originalname
      );

      const records = [];

      await new Promise((resolve, reject) => {
        fs.createReadStream(uploadedFilePath)
          .pipe(
            csv({
              mapHeaders: ({ header }) =>
                cleanText(header),
            })
          )
          .on("data", (data) => {
            records.push(data);
          })
          .on("end", resolve)
          .on("error", reject);
      });

      console.log(
        `Parsed ${records.length} CSV records`
      );

      if (records.length === 0) {
        return res.status(400).json({
          success: false,
          error: "CSV file contains no records",
        });
      }

      const validRecords = [];
      const skippedRecords = [];

      for (const record of records) {
        if (isValidLead(record)) {
          validRecords.push(record);
        } else {
          skippedRecords.push(record);
        }
      }

      console.log(
        "Valid records:",
        validRecords.length
      );

      console.log(
        "Skipped records:",
        skippedRecords.length
      );

      const importedRecords =
        await processRecordsInBatches(
          validRecords
        );

      console.log(
        "CRM processing completed successfully"
      );

      return res.json({
        success: true,
        records: importedRecords,
        skippedRecords,
        totalImported:
          importedRecords.length,
        totalSkipped:
          skippedRecords.length,
      });
    } catch (error) {
      console.error("");
      console.error("IMPORT ERROR:");
      console.error(error);

      return res.status(500).json({
        success: false,
        error: "Failed to process CSV file",
        details: error.message,
      });
    } finally {
      if (
        uploadedFilePath &&
        fs.existsSync(uploadedFilePath)
      ) {
        try {
          fs.unlinkSync(uploadedFilePath);
        } catch (error) {
          console.error(
            "Upload cleanup error:",
            error.message
          );
        }
      }
    }
  }
);

app.listen(PORT, () => {
  console.log("");
  console.log(
    "======================================"
  );
  console.log("GrowEasy backend running");
  console.log(
    `Backend URL: http://localhost:${PORT}`
  );
  console.log(
    "Gemini API key loaded:",
    Boolean(GEMINI_API_KEY)
  );
  console.log(
    "AI fallback protection: ENABLED"
  );
  console.log("CRM fields:", CRM_FIELDS.length);
  console.log(
    "======================================"
  );
  console.log("");
});