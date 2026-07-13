import {
  Body,
  Container,
  Head,
  Heading,
  Hr,
  Html,
  Link,
  Preview,
  Section,
  Text,
} from "@react-email/components";

const BLUE = "#094FA4";
const RED = "#C5122F";
const WHITE = "#FAFAFA";
const INK = "#16233A";

export function BrandEmail({
  preview,
  heading,
  children,
  footerNote,
}: {
  preview: string;
  heading: string;
  children: React.ReactNode;
  footerNote?: string;
}) {
  return (
    <Html>
      <Head />
      <Preview>{preview}</Preview>
      <Body style={{ backgroundColor: WHITE, fontFamily: "Helvetica, Arial, sans-serif", margin: 0 }}>
        <Container style={{ maxWidth: "560px", margin: "0 auto", padding: "24px 16px" }}>
          <Section
            style={{
              backgroundColor: BLUE,
              borderRadius: "10px 10px 0 0",
              padding: "20px 28px",
            }}
          >
            <Text
              style={{
                color: "#FFFFFF",
                fontSize: "18px",
                fontWeight: 700,
                letterSpacing: "2px",
                margin: 0,
              }}
            >
              MELBOURNE MAKERSPACE
            </Text>
            <Text
              style={{
                color: "#BFD2EC",
                fontSize: "11px",
                letterSpacing: "3px",
                margin: "2px 0 0",
              }}
            >
              FLORIDA – USA
            </Text>
          </Section>
          <Section
            style={{
              backgroundColor: "#FFFFFF",
              border: "1px solid #DDE4ED",
              borderTop: "none",
              borderRadius: "0 0 10px 10px",
              padding: "28px",
            }}
          >
            <Heading
              as="h1"
              style={{ color: INK, fontSize: "20px", margin: "0 0 16px" }}
            >
              {heading}
            </Heading>
            {children}
            <Hr style={{ borderColor: "#DDE4ED", margin: "24px 0 16px" }} />
            <Text style={{ color: "#5B6B82", fontSize: "12px", margin: 0 }}>
              {footerNote ??
                "You're receiving this because you have a Melbourne Makerspace account."}{" "}
              <Link
                href="https://melbournemakerspace.org"
                style={{ color: BLUE }}
              >
                melbournemakerspace.org
              </Link>
            </Text>
          </Section>
        </Container>
      </Body>
    </Html>
  );
}

export function EmailButton({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      style={{
        backgroundColor: BLUE,
        borderRadius: "8px",
        color: "#FFFFFF",
        display: "inline-block",
        fontSize: "14px",
        fontWeight: 600,
        padding: "12px 24px",
        textDecoration: "none",
      }}
    >
      {children}
    </Link>
  );
}

export function EmailText({ children }: { children: React.ReactNode }) {
  return (
    <Text style={{ color: INK, fontSize: "14px", lineHeight: "22px", margin: "0 0 14px" }}>
      {children}
    </Text>
  );
}

export function DangerText({ children }: { children: React.ReactNode }) {
  return (
    <Text style={{ color: RED, fontSize: "14px", fontWeight: 600, margin: "0 0 14px" }}>
      {children}
    </Text>
  );
}
