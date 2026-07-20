import SibApiV3Sdk from "sib-api-v3-sdk";
import dotenv from "dotenv";

if (process.env.NODE_ENV !== "production") {
  dotenv.config();
}

const client = SibApiV3Sdk.ApiClient.instance;
const apiKey = client.authentications["api-key"];
apiKey.apiKey = process.env.BREVO_API_KEY;

const apiInstance = new SibApiV3Sdk.TransactionalEmailsApi();

/**
 * Send a transactional email via Brevo.
 * @param {object} options
 * @param {string} options.to - recipient email address
 * @param {string} options.subject
 * @param {string} options.html - HTML content
 * @param {Array}  [options.attachments]
 */
const sendEmail = async ({ to, subject, html, attachments = [] }) => {
  try {
    if (!to) throw new Error("Recipient email is required");
    if (!subject) throw new Error("Email subject is required");
    if (!html) throw new Error("Email HTML content is required");

    const emailData = {
      sender: {
        name: process.env.SMTP_FROM || "UNIJOS Library",
        email: process.env.SMTP_FROM_EMAIL,
      },
      to: [{ email: to }],
      subject,
      htmlContent: html,
    };

    if (attachments.length > 0) {
      emailData.attachment = attachments;
    }

    const response = await apiInstance.sendTransacEmail(emailData);
    console.log("✅ Email sent:", response);
    return response;

  } catch (error) {
    console.error("❌ Brevo Email Error:", error.response?.body || error.message || error);
    throw error;
  }
};

export default sendEmail;