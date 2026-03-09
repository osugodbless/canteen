package main

import (
	"context"
	"encoding/json"
	"fmt"
	"log"
	"strings"

	"github.com/aws/aws-lambda-go/events"
	"github.com/aws/aws-lambda-go/lambda"
)

// OrderPayload exactly matches the JSON sent from your frontend app.js
type OrderPayload struct {
	Item      string   `json:"item"`
	Name      string   `json:"name"`
	Phone     string   `json:"phone"`
	Floor     int      `json:"floor"`
	Plates    int      `json:"plates"`
	Extras    []string `json:"extras"`
	Total     int      `json:"total"` // Assuming you added the calculated total to the payload
	Timestamp string   `json:"timestamp"`
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
			// Return error to keep the message in the queue (or route to a Dead Letter Queue)
			continue
		}

		// Flatten the Extras array into a single comma-separated string for Google Sheets
		extrasString := "None"
		if len(order.Extras) > 0 {
			extrasString = strings.Join(order.Extras, ", ")
		}

		// Prepare the flat array format required by the Google Sheets API
		// Columns: [Timestamp, Name, Phone, Floor, Main Item, Extras, Plates, Total]
		sheetRow := []interface{}{
			order.Timestamp,
			order.Name,
			order.Phone,
			order.Floor,
			order.Item,
			extrasString,
			order.Plates,
			order.Total,
		}

		// Call your Google Sheets writing function here
		err = WriteToGoogleSheet(sheetRow)
		if err != nil {
			log.Printf("Failed to write to Google Sheets: %v", err)
			return err // Fail the Lambda execution so the message goes back to SQS to retry later
		}

		fmt.Printf("Successfully processed order for %s\n", order.Name)
	}

	return nil
}

func main() {
	// Start the Lambda handler
	lambda.Start(HandleSQSEvent)
}
