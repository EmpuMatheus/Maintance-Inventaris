import crypto from 'node:crypto';
import { XML_PARSER_OPTIONS, parseXml, textOf, attrOf, asArray, escapeXml } from '@/lib/xml';
import type { OnvifCredentials } from './types';

/**
 * Low-level SOAP/XML helpers for ONVIF.
 *
 * ONVIF uses SOAP 1.2 with WS-Security UsernameToken digest authentication.
 * Everything here is transport-level plumbing; the client maps the parsed XML
 * into domain types and the rest of the backend never sees XML.
 *
 * The generic XML primitives are re-exported so existing ONVIF consumers keep
 * their import paths unchanged.
 */

export { XML_PARSER_OPTIONS, parseXml, textOf, attrOf, asArray };

/** WS-Security UsernameToken digest header. */
function securityHeader(credentials: OnvifCredentials): string {
  const nonce = crypto.randomBytes(16);
  const created = new Date().toISOString();
  const digest = crypto
    .createHash('sha1')
    .update(Buffer.concat([nonce, Buffer.from(created, 'utf8'), Buffer.from(credentials.password, 'utf8')]))
    .digest('base64');

  return `<Security s:mustUnderstand="1" xmlns="http://docs.oasis-open.org/wss/2004/01/oasis-200401-wss-wssecurity-secext-1.0.xsd">
      <UsernameToken>
        <Username>${escapeXml(credentials.username)}</Username>
        <Password Type="http://docs.oasis-open.org/wss/2004/01/oasis-200401-wss-username-token-profile-1.0#PasswordDigest">${digest}</Password>
        <Nonce EncodingType="http://docs.oasis-open.org/wss/2004/01/oasis-200401-wss-soap-message-security-1.0#Base64Binary">${nonce.toString('base64')}</Nonce>
        <Created xmlns="http://docs.oasis-open.org/wss/2004/01/oasis-200401-wss-wssecurity-utility-1.0.xsd">${created}</Created>
      </UsernameToken>
    </Security>`;
}

/**
 * Builds a full SOAP 1.2 envelope for an ONVIF operation. `innerXml` is the
 * operation-specific body (already escaped by the caller).
 */
export function buildEnvelope(
  credentials: OnvifCredentials,
  innerXml: string,
  withSecurity = true,
): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<s:Envelope xmlns:s="http://www.w3.org/2003/05/soap-envelope" xmlns:tds="http://www.onvif.org/ver10/device/wsdl" xmlns:trt="http://www.onvif.org/ver10/media/wsdl" xmlns:tt="http://www.onvif.org/ver10/schema">
  <s:Header>
    ${withSecurity ? securityHeader(credentials) : ''}
  </s:Header>
  <s:Body>
    ${innerXml}
  </s:Body>
</s:Envelope>`;
}

/** Extracts the SOAP Body object from a parsed envelope. */
export function extractBody(parsed: Record<string, unknown>): Record<string, any> | null {
  const envelope = (parsed.Envelope ?? parsed['SOAP-ENV:Envelope']) as Record<string, unknown> | undefined;
  if (!envelope) return null;
  const body = (envelope.Body ?? envelope['SOAP-ENV:Body']) as Record<string, unknown> | undefined;
  return body ?? null;
}

/**
 * Extracts a SOAP Fault's human-readable reason if present.
 *
 * SOAP 1.2 nests the reason as `Fault > Reason > Text` while SOAP 1.1 uses
 * `faultstring`; both are handled, plus the subcode (e.g. `ter:NotAuthorized`)
 * which is what devices use to signal an authentication failure.
 */
export function extractFault(body: Record<string, any> | null): string | null {
  if (!body) return null;
  const fault = (body.Fault ?? body['SOAP-ENV:Fault']) as Record<string, any> | undefined;
  if (!fault) return null;

  const reasonNode = fault.Reason ?? fault['SOAP-ENV:Reason'];
  const reason =
    textOf(reasonNode) ??
    textOf(reasonNode?.Text) ??
    textOf(reasonNode?.['SOAP-ENV:Text']) ??
    textOf(fault.faultstring) ??
    textOf(fault['SOAP-ENV:faultstring']);

  const codeNode = fault.Code ?? fault.faultcode ?? fault['SOAP-ENV:Code'];
  const subcode = textOf(codeNode?.Subcode?.Value) ?? textOf(codeNode?.['SOAP-ENV:Subcode']?.['SOAP-ENV:Value']);
  const code = textOf(codeNode?.Value) ?? textOf(codeNode) ?? textOf(fault.faultcode);

  const parts = [code, subcode, reason].filter((v): v is string => Boolean(v));
  return parts.length > 0 ? parts.join(': ') : 'SOAP fault';
}
