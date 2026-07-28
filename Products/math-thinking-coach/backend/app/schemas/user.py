from typing import Literal

from pydantic import BaseModel


class Teacher(BaseModel):
    id: str
    email: str
    name: str
    passwordHash: str


class ClassGroup(BaseModel):
    id: str
    teacherId: str
    name: str
    code: str


class Student(BaseModel):
    id: str
    classId: str
    displayName: str
    pinHash: str


class TeacherRegisterRequest(BaseModel):
    email: str
    password: str
    name: str


class TeacherLoginRequest(BaseModel):
    email: str
    password: str


class TeacherPublic(BaseModel):
    id: str
    email: str
    name: str


class ClassCreateRequest(BaseModel):
    name: str


class ClassPublic(BaseModel):
    id: str
    name: str
    code: str


class StudentJoinRequest(BaseModel):
    classCode: str
    displayName: str
    pin: str


class StudentLoginRequest(BaseModel):
    classCode: str
    displayName: str
    pin: str


class StudentPublic(BaseModel):
    id: str
    classId: str
    displayName: str


class CurrentUser(BaseModel):
    role: Literal["teacher", "student"]
    id: str
    name: str
