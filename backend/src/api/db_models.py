from sqlalchemy import Boolean, Column, ForeignKey, Integer, String
from sqlalchemy.orm import relationship

from backend.src.api.db import Base


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    email = Column(String, unique=True, index=True, nullable=False)
    hashed_password = Column(String, nullable=True)

    datasets = relationship("Dataset", back_populates="user", cascade="all, delete-orphan")
    dataset_files = relationship("DatasetFileMeta", back_populates="user", cascade="all, delete-orphan")
    onboarding_state = relationship(
        "UserOnboardingState",
        back_populates="user",
        uselist=False,
        cascade="all, delete-orphan",
    )


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


class UserOnboardingState(Base):
    __tablename__ = "user_onboarding_state"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), unique=True, index=True, nullable=False)
    is_onboarded = Column(Boolean, nullable=False, default=False)

    user = relationship("User", back_populates="onboarding_state")
