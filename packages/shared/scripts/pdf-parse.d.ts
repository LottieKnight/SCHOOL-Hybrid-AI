declare module "pdf-parse" {
  const pdfParse: (data: any, options?: any) => Promise<{ text: string }>;
  export default pdfParse;
}
