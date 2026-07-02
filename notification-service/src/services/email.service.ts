export const sendEmail = async (userId: string, subject: string, message: string) => {
  // In a real application, you would lookup the user's email from the user-service
  // and use a provider like SendGrid or AWS SES to send the email.
  
  // For this mock implementation, we just log to the console.
  console.log(`\n================= EMAIL NOTIFICATION =================`);
  console.log(`To User ID: ${userId}`);
  console.log(`Subject:    ${subject}`);
  console.log(`Message:    ${message}`);
  console.log(`======================================================\n`);
  
  // Simulate network delay
  return new Promise(resolve => setTimeout(resolve, 500));
};
