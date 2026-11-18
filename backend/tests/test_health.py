from fastapi import status


def test_root_endpoint(client):
    """Test the root endpoint returns project metadata and status."""
    response = client.get("/")
    assert response.status_code == status.HTTP_200_OK
    data = response.json()
    assert data["name"] == "HealthSync AI"
    assert data["status"] == "online"
    assert data["health"] == "/health"
    assert data["docs"] == "/docs"
    assert "disclaimer" in data


def test_health_check_endpoint(client):
    """Test the GET /health endpoint returns operational status."""
    response = client.get("/health")
    assert response.status_code == status.HTTP_200_OK
    data = response.json()
    assert data["status"] == "healthy"
    assert "version" in data
    assert "environment" in data
    assert "timestamp" in data
    assert "uptime_seconds" in data
    assert data["uptime_seconds"] >= 0


def test_api_v1_health_check_endpoint(client):
    """Test the GET /api/v1/health versioned endpoint."""
    response = client.get("/api/v1/health")
    assert response.status_code == status.HTTP_200_OK
    data = response.json()
    assert data["status"] == "healthy"


def test_docs_accessible(client):
    """Test Swagger UI documentation is accessible at /docs."""
    response = client.get("/docs")
    assert response.status_code == status.HTTP_200_OK
    assert "swagger-ui" in response.text.lower() or "html" in response.headers.get("content-type", "").lower()


def test_openapi_schema(client):
    """Test OpenAPI JSON schema is generated properly."""
    response = client.get("/openapi.json")
    assert response.status_code == status.HTTP_200_OK
    schema = response.json()
    assert schema["info"]["title"] == "HealthSync AI"
    assert "/health" in schema["paths"]
    assert "/api/v1/health" in schema["paths"]


def test_not_found_handler(client):
    """Test non-existent endpoints return standardized error format."""
    response = client.get("/non-existent-path")
    assert response.status_code == status.HTTP_404_NOT_FOUND
    data = response.json()
    assert "error" in data
    assert data["error"]["code"] == "HTTP_ERROR"
