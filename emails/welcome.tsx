import {
  Body,
  Button,
  Container,
  Head,
  Heading,
  Html,
  Preview,
  Section,
  Text,
} from "@react-email/components";

interface WelcomeEmailProps {
  url: string;
  firstName: string;
}

export default function WelcomeEmail({ url, firstName }: WelcomeEmailProps) {
  return (
    <Html>
      <Head />
      <Preview>Welcome to Melbourne Makerspace</Preview>
      <Body style={main}>
        <Container style={container}>
          <Section style={header}>
            <Text style={brand}>Melbourne Makerspace</Text>
          </Section>

          <Section style={content}>
            <Heading style={heading}>Welcome to Melbourne Makerspace!</Heading>

            <Text style={paragraph}>Hi {firstName},</Text>

            <Text style={paragraph}>
              You&apos;ve been invited to join the Melbourne Makerspace member
              portal. Click the button below to set up your account.
            </Text>

            <Section style={buttonContainer}>
              <Button style={button} href={url}>
                Set Up Your Account
              </Button>
            </Section>

            <Text style={footerText}>This link expires in 24 hours.</Text>

            <Text style={paragraph}>
              With your account you can: view your membership status, check your
              payment history, see your equipment certifications, and more.
            </Text>

            <Text style={footerText}>
              If you didn&apos;t expect this email, you can safely ignore it.
            </Text>
          </Section>

          <Section style={footer}>
            <Text style={footerBrand}>Melbourne Makerspace</Text>
          </Section>
        </Container>
      </Body>
    </Html>
  );
}

const main = {
  backgroundColor: "#f6f9fc",
  fontFamily:
    '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Ubuntu, sans-serif',
};

const container = {
  backgroundColor: "#ffffff",
  margin: "0 auto",
  padding: "0",
  maxWidth: "560px",
  borderRadius: "8px",
  overflow: "hidden" as const,
};

const header = {
  backgroundColor: "#094FA4",
  padding: "24px 32px",
};

const brand = {
  color: "#ffffff",
  fontSize: "20px",
  fontWeight: "bold" as const,
  margin: "0",
};

const content = {
  padding: "32px",
};

const heading = {
  color: "#1a1a1a",
  fontSize: "24px",
  fontWeight: "bold" as const,
  margin: "0 0 24px",
};

const paragraph = {
  color: "#4a4a4a",
  fontSize: "16px",
  lineHeight: "24px",
  margin: "0 0 16px",
};

const buttonContainer = {
  textAlign: "center" as const,
  margin: "32px 0",
};

const button = {
  backgroundColor: "#094FA4",
  borderRadius: "6px",
  color: "#ffffff",
  fontSize: "16px",
  fontWeight: "bold" as const,
  textDecoration: "none",
  textAlign: "center" as const,
  display: "inline-block",
  padding: "12px 32px",
};

const footerText = {
  color: "#8898aa",
  fontSize: "14px",
  lineHeight: "20px",
  margin: "0 0 8px",
};

const footer = {
  backgroundColor: "#f6f9fc",
  padding: "16px 32px",
  textAlign: "center" as const,
};

const footerBrand = {
  color: "#8898aa",
  fontSize: "12px",
  margin: "0",
};
