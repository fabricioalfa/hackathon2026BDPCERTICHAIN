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
  issueDate: string;
  expiryDate: string;
  status: string;
  qrUrl: string;
  issuedBy: string;
}

export interface IssueCertificateRequest {
  title: string;
  docType: string;
  holderDni?: string;
  holderName?: string;
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

  verifyPublic(uuid: string, hash: string) {
    const params = new HttpParams().set('uuid', uuid).set('hash', hash);
    return this.http.get<Certificate>(`${environment.apiUrl}/api/public/verify`, { params });
  }
}
