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


class SelfServeLearner(BaseModel):
    """
    Minimal, transitional base identity for a learner with no class/teacher
    relationship (Option 3 of the approved identity-shape analysis). Deliberately
    thin: no password/PIN/email - nothing to authenticate against, since identity
    continuity for this slice comes from the signed session cookie alone (see
    ADR-004's SessionMiddleware). Persisted (not just cookie-held) so a real row
    exists for any future recovery/linking mechanism to attach to. Stored
    separately from Student on purpose - it is not a class-membership record and
    must never be conflated with one. Id is namespaced ("learner_" prefix,
    reusing uuid4().hex) so it is structurally, not just probabilistically,
    disjoint from Student/Teacher ids (plain uuid4().hex, never containing "_").
    """

    id: str
    createdAt: str


class CurrentUser(BaseModel):
    role: Literal["teacher", "student"]
    id: str
    # Optional: a SelfServeLearner has no display name to report (no join-time
    # name collection exists for it). Existing teacher/student callers are
    # unaffected - both still always populate this.
    name: str | None = None
