package main

import (
	"encoding/json"
	"fmt"
	"time"

	"github.com/hyperledger/fabric-contract-api-go/contractapi"
)

// Certificate representa un certificado digital registrado en el ledger.
type Certificate struct {
	UUID        string `json:"uuid"`
	DocumentHash string `json:"documentHash"`
	Title       string `json:"title"`
	DocType     string `json:"docType"`
	HolderDNI   string `json:"holderDni"`
	HolderName  string `json:"holderName"`
	Issuer      string `json:"issuer"`
	IssuedAt    string `json:"issuedAt"`
	ExpiresAt   string `json:"expiresAt"`
	Status      string `json:"status"`
}

// CertchainContract define el contrato inteligente de certificacion.
type CertchainContract struct {
	contractapi.Contract
}

// Emitir registra un nuevo certificado en el ledger.
// La clave es el UUID; se guarda el hash del documento para verificacion posterior.
func (cc *CertchainContract) Emitir(ctx contractapi.TransactionContextInterface,
	uuid, documentHash, title, docType, holderDni, holderName, expiresAt string) error {

	existing, err := ctx.GetStub().GetState(uuid)
	if err != nil {
		return fmt.Errorf("error al leer el estado: %v", err)
	}
	if existing != nil {
		return fmt.Errorf("el certificado %s ya existe en el ledger", uuid)
	}

	issuer, err := ctx.GetClientIdentity().GetID()
	if err != nil {
		return fmt.Errorf("error obteniendo identidad del emisor: %v", err)
	}

	cert := Certificate{
		UUID:         uuid,
		DocumentHash: documentHash,
		Title:        title,
		DocType:      docType,
		HolderDNI:    holderDni,
		HolderName:   holderName,
		Issuer:       issuer,
		IssuedAt:     time.Now().UTC().Format(time.RFC3339),
		ExpiresAt:    expiresAt,
		Status:       "ACTIVE",
	}

	bytes, err := json.Marshal(cert)
	if err != nil {
		return fmt.Errorf("error al serializar el certificado: %v", err)
	}
	return ctx.GetStub().PutState(uuid, bytes)
}

// Consultar devuelve un certificado por su UUID.
func (cc *CertchainContract) Consultar(ctx contractapi.TransactionContextInterface, uuid string) (*Certificate, error) {
	bytes, err := ctx.GetStub().GetState(uuid)
	if err != nil {
		return nil, fmt.Errorf("error al consultar: %v", err)
	}
	if bytes == nil {
		return nil, fmt.Errorf("certificado %s no encontrado", uuid)
	}
	var cert Certificate
	if err := json.Unmarshal(bytes, &cert); err != nil {
		return nil, fmt.Errorf("error al deserializar: %v", err)
	}
	return &cert, nil
}

// VerificarHash confirma que el hash corresponde al certificado registrado.
func (cc *CertchainContract) VerificarHash(ctx contractapi.TransactionContextInterface, uuid, hash string) (bool, error) {
	cert, err := cc.Consultar(ctx, uuid)
	if err != nil {
		return false, err
	}
	if cert.Status != "ACTIVE" {
		return false, nil
	}
	return cert.DocumentHash == hash, nil
}

// Revocar cambia el estado del certificado a REVOKED.
func (cc *CertchainContract) Revocar(ctx contractapi.TransactionContextInterface, uuid string) error {
	cert, err := cc.Consultar(ctx, uuid)
	if err != nil {
		return err
	}
	cert.Status = "REVOKED"
	bytes, err := json.Marshal(cert)
	if err != nil {
		return fmt.Errorf("error al serializar: %v", err)
	}
	return ctx.GetStub().PutState(uuid, bytes)
}

// Historial devuelve la trazabilidad completa del certificado.
func (cc *CertchainContract) Historial(ctx contractapi.TransactionContextInterface, uuid string) ([]map[string]interface{}, error) {
	iterator, err := ctx.GetStub().GetHistoryForKey(uuid)
	if err != nil {
		return nil, fmt.Errorf("error al obtener historial: %v", err)
	}
	defer iterator.Close()

	var history []map[string]interface{}
	for iterator.HasNext() {
		mod, err := iterator.Next()
		if err != nil {
			return nil, fmt.Errorf("error iterando historial: %v", err)
		}
		entry := map[string]interface{}{
			"txId":      mod.TxId,
			"timestamp": mod.Timestamp.AsTime().Format(time.RFC3339),
			"deleted":   mod.IsDelete,
			"value":     string(mod.Value),
		}
		history = append(history, entry)
	}
	return history, nil
}

// ListarTodos devuelve todos los certificados registrados.
func (cc *CertchainContract) ListarTodos(ctx contractapi.TransactionContextInterface) ([]Certificate, error) {
	query := `{"selector":{"docType":{"$ne":null}}}`
	results, err := ctx.GetStub().GetQueryResult(query)
	if err != nil {
		return nil, fmt.Errorf("error en la consulta: %v", err)
	}
	defer results.Close()

	var certs []Certificate
	for results.HasNext() {
		result, err := results.Next()
		if err != nil {
			return nil, err
		}
		var cert Certificate
		if err := json.Unmarshal(result.Value, &cert); err != nil {
			return nil, err
		}
		certs = append(certs, cert)
	}
	return certs, nil
}

func main() {
	chaincode, err := contractapi.NewChaincode(&CertchainContract{})
	if err != nil {
		panic(fmt.Sprintf("Error creando chaincode: %v", err))
	}
	if err := chaincode.Start(); err != nil {
		panic(fmt.Sprintf("Error iniciando chaincode: %v", err))
	}
}
