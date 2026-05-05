import io
import os
from typing import Iterable

import boto3
import pandas as pd
from botocore.exceptions import ClientError
from fastapi import UploadFile


class StorageService:
    def __init__(
        self,
        bucket: str | None = None,
        region: str | None = None,
        access_key: str | None = None,
        secret_key: str | None = None,
    ):
        self.bucket = bucket or os.getenv("AWS_S3_BUCKET")
        self.region = region or os.getenv("AWS_REGION")
        self.access_key = access_key or os.getenv("AWS_ACCESS_KEY_ID")
        self.secret_key = secret_key or os.getenv("AWS_SECRET_ACCESS_KEY")

        if not self.bucket:
            raise RuntimeError("AWS_S3_BUCKET is required to use S3 storage.")

        client_kwargs = {}
        if self.region:
            client_kwargs["region_name"] = self.region
        if self.access_key and self.secret_key:
            client_kwargs["aws_access_key_id"] = self.access_key
            client_kwargs["aws_secret_access_key"] = self.secret_key

        self.s3 = boto3.client("s3", **client_kwargs)

    def build_key(self, file_uuid: str, suffix: str = "raw", ext: str = "csv", prefix: str = "uploads") -> str:
        filename = f"{file_uuid}_{suffix}.{ext}"
        return self.join_key(prefix, filename)

    @staticmethod
    def join_key(prefix: str, filename: str) -> str:
        clean_prefix = prefix.strip("/")
        clean_filename = filename.lstrip("/")
        return f"{clean_prefix}/{clean_filename}" if clean_prefix else clean_filename

    def save_upload(self, upload_file: UploadFile, key: str) -> None:
        upload_file.file.seek(0)
        try:
            self.s3.upload_fileobj(
                upload_file.file,
                self.bucket,
                key,
                ExtraArgs={"ContentType": upload_file.content_type or "text/csv"},
            )
        finally:
            upload_file.file.close()

    def put_bytes(self, key: str, data: bytes, content_type: str = "application/octet-stream") -> None:
        self.s3.put_object(Bucket=self.bucket, Key=key, Body=data, ContentType=content_type)

    def put_text(self, key: str, text: str, content_type: str = "text/plain") -> None:
        self.put_bytes(key, text.encode("utf-8"), content_type=content_type)

    def read_bytes(self, key: str) -> bytes:
        obj = self.s3.get_object(Bucket=self.bucket, Key=key)
        return obj["Body"].read()

    def read_csv(self, key: str) -> pd.DataFrame:
        data = self.read_bytes(key)
        return pd.read_csv(io.BytesIO(data))

    def write_csv(self, key: str, df: pd.DataFrame, include_index: bool = False) -> None:
        buffer = io.StringIO()
        df.to_csv(buffer, index=include_index)
        self.put_text(key, buffer.getvalue(), content_type="text/csv")

    def stream_object(self, key: str, chunk_size: int = 1024 * 1024) -> Iterable[bytes]:
        obj = self.s3.get_object(Bucket=self.bucket, Key=key)
        return obj["Body"].iter_chunks(chunk_size=chunk_size)

    def exists(self, key: str) -> bool:
        try:
            self.s3.head_object(Bucket=self.bucket, Key=key)
            return True
        except ClientError as exc:
            code = exc.response.get("Error", {}).get("Code")
            if code in {"404", "NoSuchKey", "NotFound"}:
                return False
            raise

    def delete(self, key: str) -> None:
        self.s3.delete_object(Bucket=self.bucket, Key=key)

    def delete_many(self, keys: list[str]) -> None:
        if not keys:
            return
        objects = [{"Key": key} for key in keys]
        self.s3.delete_objects(Bucket=self.bucket, Delete={"Objects": objects})
