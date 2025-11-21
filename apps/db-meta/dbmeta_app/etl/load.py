import json
import pathlib

import numpy as np
import openai
import pymilvus
from pymilvus import (
    Collection,
    CollectionSchema,
    DataType,
    FieldSchema,
    connections,
    utility,
)

from dbmeta_app.config import get_settings
from dbmeta_app.prompt_assembler.prompt_packs import assemble_effective_tree, load_yaml

# print(os.getenv("VECTOR_DB_EMBEDDINGS"))


settings = get_settings()
# print(settings.vector_db_embeddings)


def get_collection_name(client: str, env: str, profile: str, suffix: str) -> str:
    """Generate collection name with pattern: {client}_{env}_{profile}_{suffix}"""
    return f"{client}_{env}_{profile}_{suffix}"


def get_embeddings(
    texts: list[str], model: str = settings.vector_db_embeddings
) -> list[list[float]]:
    response = openai.embeddings.create(input=texts, model=model)
    # Order is preserved in OpenAI responses
    return [r.embedding for r in response.data]


def normalize_vector(vector):
    norm = np.linalg.norm(vector)
    return vector / (norm if norm > 0 else vector)  # Avoid division by zero


def connect_to_milvus():
    """Establish connection to Milvus"""
    if settings.vector_db_port is not None and settings.vector_db_host is not None:
        connections.connect(
            host=settings.vector_db_host,
            port=settings.vector_db_port,
        )
    elif settings.vector_db_connection_string is not None:
        connections.connect(
            alias="default",
            uri=settings.vector_db_connection_string,
        )
    else:
        raise ValueError("No vector DB connection configuration found")


def load_query_examples():
    settings = get_settings()
    repo_root = pathlib.Path(settings.packs_resources_dir).resolve()
    client = settings.client
    env = settings.env
    profile = settings.default_profile
    tree = assemble_effective_tree(repo_root, profile, client, env)

    file = load_yaml(tree, "resources/query_examples.yaml")
    data = file["profiles"][profile]
    examples = []
    for row in data:
        request = row.get("request", "").strip()
        response = row.get("response", "").strip()
        db = row.get("db", "").strip()
        # print(f"loading: {request} -> {response} ({db})")
        examples.append((request, response, db))

    # Generate embeddings
    example_texts = [
        f"User request: {request}, SQL response {response}"
        for request, response, db in examples
    ]
    token_embeddings = get_embeddings(example_texts)

    # Connect to Milvus
    connect_to_milvus()

    # Define schema
    fields = [
        FieldSchema(name="id", dtype=DataType.INT64, is_primary=True, auto_id=True),
        FieldSchema(
            name="embedding", dtype=DataType.FLOAT_VECTOR, dim=len(token_embeddings[0])
        ),
        FieldSchema(name="request", dtype=DataType.VARCHAR, max_length=1000),
        FieldSchema(name="response", dtype=DataType.VARCHAR, max_length=5000),
        FieldSchema(name="db", dtype=DataType.VARCHAR, max_length=20),
    ]
    schema = CollectionSchema(fields, description="Query examples")

    # Create or load collection with new naming pattern
    collection_name = get_collection_name(client, env, profile, "examples")
    index_params = {
        "metric_type": settings.vector_db_metric_type,
        # Use Inner Product for Cosine Similarity
        "index_type": settings.vector_db_index_type,
        # Choose IVF_FLAT, IVF_PQ, or HNSW as needed
        "params": json.loads(settings.vector_db_params),
        # Adjust based on dataset size
    }
    if collection_name in pymilvus.utility.list_collections():
        utility.drop_collection(collection_name)
    collection = Collection(name=collection_name, schema=schema)
    collection.create_index("embedding", index_params)

    # Insert data into Milvus
    entities = [
        {
            "embedding": normalize_vector(np.array(token_embeddings[i])),
            # "embedding": normalized_vector,
            "request": examples[i][0],
            "response": examples[i][1],
            "db": examples[i][2],
        }
        for i in range(len(examples))
    ]

    collection.insert(entities)
    collection.flush()
    print(f"Loaded {len(examples)} query examples into collection: {collection_name}")


def load_table_schemas():
    """Load table schemas from schema_descriptions.yaml into Milvus for semantic search"""
    settings = get_settings()
    repo_root = pathlib.Path(settings.packs_resources_dir).resolve()
    client = settings.client
    env = settings.env
    profile = settings.default_profile
    tree = assemble_effective_tree(repo_root, profile, client, env)

    # Load schema descriptions
    file = load_yaml(tree, "resources/schema_descriptions.yaml")
    tables_data = file["profiles"][profile]["tables"]

    # Build table descriptions for embedding
    table_records = []
    for table_name, table_info in tables_data.items():
        # Combine table description with column descriptions
        description = table_info.get("description", "").strip()

        # Add column information
        columns = table_info.get("columns", {})
        column_descriptions = []
        for col_name, col_info in columns.items():
            # Skip hidden columns
            if col_info.get("hidden", False):
                continue
            col_desc = col_info.get("description", "").strip()
            if col_desc:
                column_descriptions.append(f"{col_name}: {col_desc}")

        # Create searchable text: table name + description + columns
        searchable_text = f"Table {table_name}. {description}"
        if column_descriptions:
            searchable_text += " Columns: " + "; ".join(column_descriptions)

        # Store full column info as JSON for retrieval
        columns_json = json.dumps(table_info.get("columns", {}))

        table_records.append(
            {
                "table_name": table_name,
                "description": description,
                "searchable_text": searchable_text,
                "columns_json": columns_json,
            }
        )

    # Generate embeddings for searchable texts
    searchable_texts = [rec["searchable_text"] for rec in table_records]
    embeddings = get_embeddings(searchable_texts)

    # Connect to Milvus
    connect_to_milvus()

    # Define schema for tables collection
    fields = [
        FieldSchema(name="id", dtype=DataType.INT64, is_primary=True, auto_id=True),
        FieldSchema(
            name="embedding", dtype=DataType.FLOAT_VECTOR, dim=len(embeddings[0])
        ),
        FieldSchema(name="table_name", dtype=DataType.VARCHAR, max_length=200),
        FieldSchema(name="description", dtype=DataType.VARCHAR, max_length=2000),
        FieldSchema(name="columns_json", dtype=DataType.VARCHAR, max_length=65000),
        FieldSchema(name="profile", dtype=DataType.VARCHAR, max_length=50),
    ]
    schema = CollectionSchema(fields, description="Table schemas for semantic search")

    # Create collection with new naming pattern
    collection_name = get_collection_name(client, env, profile, "tables")
    index_params = {
        "metric_type": settings.vector_db_metric_type,
        "index_type": settings.vector_db_index_type,
        "params": json.loads(settings.vector_db_params),
    }

    if collection_name in pymilvus.utility.list_collections():
        utility.drop_collection(collection_name)
    collection = Collection(name=collection_name, schema=schema)
    collection.create_index("embedding", index_params)

    # Insert data into Milvus
    entities = [
        {
            "embedding": normalize_vector(np.array(embeddings[i])),
            "table_name": table_records[i]["table_name"],
            "description": table_records[i]["description"],
            "columns_json": table_records[i]["columns_json"],
            "profile": profile,
        }
        for i in range(len(table_records))
    ]

    collection.insert(entities)
    collection.flush()
    print(
        f"Loaded {len(table_records)} table schemas into collection: {collection_name}"
    )


def get_hits(query: str, db: str, top_k=3):
    """Search for similar query examples (legacy function for testing)"""
    settings = get_settings()
    client = settings.client
    env = settings.env
    profile = settings.default_profile

    query_embedding = get_embeddings([query])

    search_params = {
        "metric_type": settings.vector_db_metric_type,
        "params": json.loads(settings.vector_db_params),
    }

    fields = [
        FieldSchema(name="id", dtype=DataType.INT64, is_primary=True, auto_id=True),
        FieldSchema(
            name="embedding",
            dtype=DataType.FLOAT_VECTOR,
            dim=len(get_embeddings([query])[0]),
        ),
        FieldSchema(name="request", dtype=DataType.VARCHAR, max_length=1000),
        FieldSchema(name="response", dtype=DataType.VARCHAR, max_length=5000),
        FieldSchema(name="db", dtype=DataType.VARCHAR, max_length=20),
    ]
    schema = CollectionSchema(fields, description="Query examples")
    collection_name = get_collection_name(client, env, profile, "examples")
    collection = Collection(name=collection_name, schema=schema)

    results = collection.search(
        data=[normalize_vector(np.array(query_embedding[0]))],  # Query vector
        anns_field="embedding",
        param=search_params,
        limit=top_k,
        output_fields=["request", "response"],
        expr=f'db == "{db}"',
    )
    from dbmeta_app.vector_db.milvus import QueryExample

    output = []
    for i, hit in enumerate(results[0]):
        request = hit.entity.get("request")
        response = hit.entity.get("response")
        output.append(
            QueryExample(request=request, response=response, score=1 / (1 + hit.score))
        )

    return output


def test_vector_db():
    """Test function for query example search"""
    question = "What wallet held the most MOBILE tokens on February 12th, 2025."
    hits = get_hits(query=question, db="wh_v2")
    print(f"Query: {question}")
    print(f"Found {len(hits)} similar examples")


def main():
    print("Loading data into Milvus...")
    load_query_examples()
    load_table_schemas()
    print("\nAll data loaded successfully!")


if __name__ == "__main__":
    main()
