import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../environments/environment';

export interface OcrResult {
  requestId: string;
  filename: string;
  language: string;
  text: string;
  lines: string[];
  detectedDni: string | null;
  detectedName: string | null;
  detectedDateOfBirth: string | null;
  fieldsDetected: number;
}

@Injectable({ providedIn: 'root' })
export class OcrService {
  constructor(private http: HttpClient) {}

  extract(file: File) {
    const formData = new FormData();
    formData.append('file', file, file.name);
    return this.http.post<OcrResult>(`${environment.apiUrl}/api/ocr/extract`, formData);
  }
}