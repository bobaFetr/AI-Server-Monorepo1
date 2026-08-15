import requests
import json

SERVER_URL = "http://192.168.1.***:5000/api/message"

message = input("Enter command: ")

response = requests.post(
    SERVER_URL,
    json={
        "message": message
    },
    timeout=5
)

print("HTTP:", response.status_code)

try:
    data = response.json()

    print("Server response:")
    print(
        json.dumps(
            data,
            indent=4,
            ensure_ascii=False
        )
    )

except Exception:
    print("Raw response:")
    print(response.text)