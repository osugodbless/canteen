package main

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net/http"
	"os"
	"strings"

	"github.com/aws/aws-lambda-go/events"
	"github.com/aws/aws-lambda-go/lambda"
)

// OrderPayload exactly matches the JSON sent from your frontend app.js
type OrderPayload struct {
	Item       string   `json:"item"`
	Name       string   `json:"name"`
	Phone      string   `json:"phone"`
	Floor      int      `json:"floor"`
	Plates     int      `json:"plates"`
	Extras     []string `json:"extras"`
	PaymentRef string   `json:"paymentRef"`
	Total      int      `json:"total"`
	Timestamp  string   `json:"timestamp"`
}

// HandleSQSEvent is the main entry point for the Lambda function
func HandleSQSEvent(ctx context.Context, sqsEvent events.SQSEvent) error {
	// SQS can send multiple messages in a single batch
	for _, message := range sqsEvent.Records {
		fmt.Printf("Processing message ID: %s\n", message.MessageId)

		var order OrderPayload
		// Unmarshal the stringified JSON from the SQS message body into our Go struct
		err := json.Unmarshal([]byte(message.Body), &order)
		if err != nil {
			log.Printf("Error unmarshaling order payload: %v", err)
			// Continue to the next message in the batch if this one is malformed
			continue
		}

		// Call your Google Sheets writing function, passing the struct directly
		err = WriteToGoogleSheet(order)
		if err != nil {
			log.Printf("Failed to write to Google Sheets: %v", err)
			// Return the error to fail the Lambda execution.
			// This tells SQS to keep the message in the queue and retry it later.
			return err
		}

		fmt.Printf("Successfully processed order for %s\n", order.Name)
	}

	return nil
}

// WriteToGoogleSheet now just makes a simple HTTP POST request
func WriteToGoogleSheet(order OrderPayload) error {
	// 1. Get your Apps Script Web App URL from Lambda environment variables
	scriptURL := os.Getenv("APPS_SCRIPT_URL")
	if scriptURL == "" {
		return fmt.Errorf("APPS_SCRIPT_URL environment variable is missing")
	}

	// 2. Flatten the Extras array into a clean string for the spreadsheet cell
	extrasString := "None"
	if len(order.Extras) > 0 {
		extrasString = strings.Join(order.Extras, ", ")
	}

	// 3. Create a flat map to send to Apps Script
	payload := map[string]interface{}{
		"timestamp":  order.Timestamp,
		"name":       order.Name,
		"phone":      order.Phone,
		"floor":      order.Floor,
		"item":       order.Item,
		"extras":     extrasString,
		"plates":     order.Plates,
		"paymentRef": order.PaymentRef,
		"total":      order.Total,
	}

	// 4. Convert the map to JSON bytes
	jsonData, err := json.Marshal(payload)
	if err != nil {
		return fmt.Errorf("failed to marshal payload: %v", err)
	}

	// 5. Fire the HTTP POST request to the Apps Script URL
	resp, err := http.Post(scriptURL, "application/json", bytes.NewBuffer(jsonData))
	if err != nil {
		return fmt.Errorf("failed to send request to Google Sheets: %v", err)
	}
	defer resp.Body.Close()

	// 6. Check if Apps Script returned an error
	if resp.StatusCode != http.StatusOK {
		bodyBytes, _ := io.ReadAll(resp.Body)
		return fmt.Errorf("received non-200 response: %d, body: %s", resp.StatusCode, string(bodyBytes))
	}

	return nil
}

func main() {
	// Start the Lambda handler
	lambda.Start(HandleSQSEvent)
}
