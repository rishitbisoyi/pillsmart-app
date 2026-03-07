import datetime
from datetime import timezone
from flask import Flask, jsonify, request, send_from_directory
from flask_cors import CORS
from pymongo import MongoClient
from pymongo.server_api import ServerApi
from dotenv import load_dotenv
import os
from flask_bcrypt import Bcrypt
import jwt
from functools import wraps
from bson import ObjectId

load_dotenv()

MONGO_URI  = os.environ.get("MONGO_URI")
SECRET_KEY = os.environ.get("SECRET_KEY", "my_secret_key_change_this")

app = Flask(__name__, static_folder='.', static_url_path='')
app.config['SECRET_KEY'] = SECRET_KEY
app.config['MAX_CONTENT_LENGTH'] = 16 * 1024 * 1024   # 16 MB

CORS(app)
bcrypt = Bcrypt(app)

# ─────────────────────────── DATABASE ───────────────────────────

try:
    client = MongoClient(MONGO_URI, server_api=ServerApi('1'))
    db            = client['medicine_dispenser_db']
    logs_col      = db['logs']
    users_col     = db['users']
    inventory_col = db['inventory']
    print("Connected to MongoDB!")
except Exception as e:
    print(f"MongoDB connection error: {e}")
    client = None

# ─────────────────────────── HELPERS ────────────────────────────

def now_utc():
    return datetime.datetime.now(timezone.utc)

def make_token(email: str) -> str:
    return jwt.encode(
        {"email": email, "exp": now_utc() + datetime.timedelta(hours=24)},
        app.config['SECRET_KEY'],
        algorithm="HS256"
    )

def user_public(user: dict) -> dict:
    return {
        "name":            user.get("name", ""),
        "email":           user.get("email", ""),
        "phone":           user.get("phone", ""),
        "profile_pic":     user.get("profile_pic", ""),
        "custom_ringtone": user.get("custom_ringtone", "")
    }

def create_empty_slots():
    return [
        {
            "slot_number":   i,
            "medicine_name": "",
            "total_tablets": 0,
            "tablets_left":  0,
            "schedules":     []
        }
        for i in range(1, 9)
    ]

def get_or_create_inventory(email):
    """Always returns a clean list of 8 slots, sorted by slot_number."""
    user_inv = inventory_col.find_one({"user_email": email})
    if not user_inv:
        slots = create_empty_slots()
        inventory_col.insert_one({"user_email": email, "slots": slots})
        return slots

    slots = user_inv["slots"]

    # Back-fill missing slots
    existing_nums = {s["slot_number"] for s in slots}
    for i in range(1, 9):
        if i not in existing_nums:
            slots.append({
                "slot_number":   i,
                "medicine_name": "",
                "total_tablets": 0,
                "tablets_left":  0,
                "schedules":     []
            })

    slots.sort(key=lambda s: s["slot_number"])
    return slots

# ─────────────────────────── JWT DECORATOR ──────────────────────

def token_required(f):
    @wraps(f)
    def decorated(*args, **kwargs):
        token = None
        auth_header = request.headers.get("Authorization", "")

        if auth_header.startswith("Bearer "):
            token = auth_header.split(" ")[1]
        elif auth_header:
            token = auth_header

        if not token:
            return jsonify({"success": False, "message": "Token is missing"}), 401

        try:
            data = jwt.decode(token, app.config['SECRET_KEY'], algorithms=["HS256"])
            current_user = users_col.find_one({"email": data["email"]})
            if not current_user:
                return jsonify({"success": False, "message": "User not found"}), 401
        except jwt.ExpiredSignatureError:
            return jsonify({"success": False, "message": "Token has expired"}), 401
        except Exception as e:
            return jsonify({"success": False, "message": "Token is invalid", "error": str(e)}), 401

        return f(current_user, *args, **kwargs)

    return decorated

# ─────────────────────────── STATIC ─────────────────────────────

@app.route("/")
def serve_index():
    return send_from_directory(".", "index.html")

# ─────────────────────────── AUTH ───────────────────────────────

@app.route("/register", methods=["POST"])
def register_user():
    data = request.json or {}

    name     = data.get("name", "").strip()
    email    = data.get("email", "").strip().lower()
    password = data.get("password", "")

    if not name or not email or not password:
        return jsonify({"success": False, "message": "Name, email and password are required"}), 400

    if len(password) < 8:
        return jsonify({"success": False, "message": "Password must be at least 8 characters"}), 400

    if users_col.find_one({"email": email}):
        return jsonify({"success": False, "message": "An account with this email already exists"}), 400

    hashed_pw = bcrypt.generate_password_hash(password).decode("utf-8")

    users_col.insert_one({
        "name":            name,
        "email":           email,
        "phone":           data.get("phone", ""),
        "password":        hashed_pw,
        "profile_pic":     "",
        "custom_ringtone": ""
    })

    token = make_token(email)

    return jsonify({
        "success": True,
        "message": "Account created successfully",
        "token":   token,
        "email":   email,
        "name":    name
    }), 201


@app.route("/login", methods=["POST"])
def login_user():
    data = request.json or {}

    email    = data.get("email", "").strip().lower()
    password = data.get("password", "")

    if not email or not password:
        return jsonify({"success": False, "message": "Email and password are required"}), 400

    user = users_col.find_one({"email": email})

    if not user:
        return jsonify({"success": False, "message": "No account found with this email"}), 404

    if not bcrypt.check_password_hash(user["password"], password):
        return jsonify({"success": False, "message": "Incorrect password"}), 401

    token = make_token(email)

    return jsonify({
        "success": True,
        "token":   token,
        "email":   user["email"],
        "name":    user["name"]
    })


@app.route("/reset_password", methods=["POST"])
def reset_password():
    data = request.json or {}

    email        = data.get("email", "").strip().lower()
    new_password = data.get("new_password", "")

    if not email or not new_password:
        return jsonify({"success": False, "message": "Email and new password are required"}), 400

    if len(new_password) < 8:
        return jsonify({"success": False, "message": "Password must be at least 8 characters"}), 400

    user = users_col.find_one({"email": email})

    if not user:
        return jsonify({"success": False, "message": "No account found with this email"}), 404

    hashed_pw = bcrypt.generate_password_hash(new_password).decode("utf-8")
    users_col.update_one({"email": email}, {"$set": {"password": hashed_pw}})

    return jsonify({"success": True, "message": "Password updated successfully"})

# ─────────────────────────── PROFILE ────────────────────────────

@app.route("/get_profile", methods=["GET"])
@token_required
def get_profile(current_user):
    return jsonify(user_public(current_user))


@app.route("/update_profile", methods=["POST"])
@token_required
def update_profile(current_user):
    data = request.json or {}
    update_fields = {}

    if "name" in data:
        name = data["name"].strip()
        if name:
            update_fields["name"] = name

    if "phone" in data:
        update_fields["phone"] = data["phone"].strip()

    if "profile_pic" in data:
        pic = data["profile_pic"]
        if len(pic) > 8 * 1024 * 1024:
            return jsonify({"success": False, "message": "Profile picture too large (max 8 MB)"}), 413
        update_fields["profile_pic"] = pic

    if "custom_ringtone" in data:
        update_fields["custom_ringtone"] = data["custom_ringtone"]

    if "new_password" in data and data["new_password"]:
        if len(data["new_password"]) < 8:
            return jsonify({"success": False, "message": "Password must be at least 8 characters"}), 400
        update_fields["password"] = bcrypt.generate_password_hash(
            data["new_password"]
        ).decode("utf-8")

    if not update_fields:
        return jsonify({"success": False, "message": "Nothing to update"}), 400

    users_col.update_one(
        {"email": current_user["email"]},
        {"$set": update_fields}
    )

    return jsonify({"success": True})

# ─────────────────────────── INVENTORY ──────────────────────────

@app.route("/get_inventory", methods=["GET"])
@token_required
def get_inventory(current_user):
    slots = get_or_create_inventory(current_user["email"])
    return jsonify(slots)


@app.route("/update_slot", methods=["POST"])
@token_required
def update_slot(current_user):
    data        = request.json or {}
    slot_number = int(data.get("slot_number", 0))

    if slot_number < 1 or slot_number > 8:
        return jsonify({"success": False, "message": "Invalid slot number"}), 400

    # Build a clean slot object — only keep known fields
    clean_slot = {
        "slot_number":   slot_number,
        "medicine_name": str(data.get("medicine_name", "")).strip(),
        "total_tablets": int(data.get("total_tablets", 0)),
        "tablets_left":  int(data.get("tablets_left",  0)),
        "schedules":     data.get("schedules", [])
    }

    # Get current full inventory
    slots = get_or_create_inventory(current_user["email"])

    # Find and replace the correct slot by slot_number (NOT by array index)
    updated = False
    for i, slot in enumerate(slots):
        if slot["slot_number"] == slot_number:
            slots[i] = clean_slot
            updated = True
            break

    if not updated:
        # Slot not found — append it (should never happen after get_or_create)
        slots.append(clean_slot)
        slots.sort(key=lambda s: s["slot_number"])

    inventory_col.update_one(
        {"user_email": current_user["email"]},
        {"$set": {"slots": slots}},
        upsert=True
    )

    return jsonify({"success": True})

# ─────────────────────────── LOGS ───────────────────────────────

@app.route("/log_dispense", methods=["POST"])
@token_required
def log_dispense_route(current_user):
    data = request.json or {}

    required = ["slot_number", "medicine_name", "dosage", "status"]
    if not all(k in data for k in required):
        return jsonify({"success": False, "message": "Missing required fields"}), 400

    logs_col.insert_one({
        "slot_number":   data["slot_number"],
        "medicine_name": data["medicine_name"],
        "dosage":        data["dosage"],
        "time":          datetime.datetime.now(datetime.timezone(datetime.timedelta(hours=5, minutes=30))).strftime("%Y-%m-%d %I:%M %p"),
        "status":        data["status"],
        "user_email":    current_user["email"]
    })

    return jsonify({"success": True})


@app.route("/get_logs", methods=["GET"])
@token_required
def get_logs_route(current_user):
    logs = []
    for log in logs_col.find(
        {"user_email": current_user["email"]}
    ).sort("_id", -1).limit(200):
        log["_id"] = str(log["_id"])
        logs.append(log)

    return jsonify(logs)


@app.route("/delete_log", methods=["POST"])
@token_required
def delete_log(current_user):
    data   = request.json or {}
    log_id = data.get("log_id", "")

    try:
        result = logs_col.delete_one({
            "_id":        ObjectId(log_id),
            "user_email": current_user["email"]
        })
        if result.deleted_count == 1:
            return jsonify({"success": True})
        return jsonify({"success": False, "message": "Log not found"}), 404
    except Exception as e:
        return jsonify({"success": False, "message": str(e)}), 400


@app.route("/delete_all_logs", methods=["POST"])
@token_required
def delete_all_logs(current_user):
    logs_col.delete_many({"user_email": current_user["email"]})
    return jsonify({"success": True})

# ─────────────────────────── DEVICE ─────────────────────────────

@app.route("/device_schedules", methods=["GET"])
def device_schedules():
    user_email = request.args.get("email", "").strip().lower()

    if not user_email:
        return jsonify({"error": "email parameter is required"}), 400

    user_inv = inventory_col.find_one({"user_email": user_email})

    if not user_inv:
        return jsonify({"schedules": []})

    result = []

    for slot in user_inv.get("slots", []):
        slot_number = slot.get("slot_number")
        for schedule in slot.get("schedules", []):
            time_str = schedule.get("time")
            if time_str and ":" in time_str:
                hour, minute = time_str.split(":")
                result.append({
                    "slot":   slot_number,
                    "hour":   int(hour),
                    "minute": int(minute)
                })

    return jsonify({"schedules": result})

# ─────────────────────────── RUN ────────────────────────────────

if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5000, debug=True)
