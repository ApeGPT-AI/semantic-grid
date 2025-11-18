export async function GET() {
  return Response.json({
    muiLicenseKey: process.env.NEXT_PUBLIC_MUIX_LICENSE_KEY,
  });
}
