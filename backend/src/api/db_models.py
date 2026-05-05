from sqlalchemy import Column, ForeignKey, Integer, String
from sqlalchemy.orm import relationship

from backend.src.api.db import Base


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    email = Column(String, unique=True, index=True, nullable=False)
    hashed_password = Column(String, nullable=True)

    datasets = relationship("Dataset", back_populates="user", cascade="all, delete-orphan")
    dataset_files = relationship("DatasetFileMeta", back_populates="user", cascade="all, delete-orphan")


class Dataset(Base):
    __tablename__ = "datasets"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), index=True, nullable=False)
    file_uuid = Column(String, unique=True, index=True, nullable=False)

    user = relationship("User", back_populates="datasets")


class DatasetFileMeta(Base):
    __tablename__ = "dataset_file_meta"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), index=True, nullable=False)
    file_uuid = Column(String, unique=True, index=True, nullable=False)
    original_filename = Column(String, nullable=False)

    user = relationship("User", back_populates="dataset_files")
