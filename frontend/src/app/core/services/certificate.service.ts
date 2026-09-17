import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { environment } from '../../../environments/environment';

export interface Certificate {
  uuid: string;
  documentHash: string;
  txId: string;
  title: string;
  docType: string;
  holderDni: string;
  holderName: string;
  holderDateOfBirth: string;
  issueDate: string;
  expiryDate: string;
  status: string;
  qrUrl: string;
  qrBase64: string;
  documentAvailable: boolean;
  issuedBy: string;
}

export interface VerificationResult {
  valid: boolean;
  message: string;
  certificate: Certificate;
}

export interface IssueCertificateRequest {
  title: string;
  docType: string;
  holderDni?: string;
  holderName?: string;
  holderDateOfBirth?: string;
  expiryDate?: string;
  metadataJson?: string;
  base64Content?: string;
}

@Injectable({ providedIn: 'root' })
export class CertificateService {
  constructor(private http: HttpClient) {}

  findAll() {
    return this.http.get<Certificate[]>(`${environment.apiUrl}/api/certificates`);
  }

  findByUuid(uuid: string) {
    return this.http.get<Certificate>(`${environment.apiUrl}/api/certificates/${uuid}`);
  }

  issue(request: IssueCertificateRequest) {
    return this.http.post<Certificate>(`${environment.apiUrl}/api/certificates`, request);
  }

  verifyPublic(uuid: string, hash?: string) {
    let params = new HttpParams().set('uuid', uuid);
    if (hash) {
      params = params.set('hash', hash);
    }
    return this.http.get<VerificationResult>(`${environment.apiUrl}/api/public/verify`, { params });
  }

  documentUrl(uuid: string) {
    return `${environment.apiUrl}/api/public/certificate/${uuid}/document`;
  }
}