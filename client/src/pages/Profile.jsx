import React, { useEffect, useMemo, useState } from "react";
import Loader from "../components/Loader.jsx";
import RecipeCard from "../components/RecipeCard.jsx";
import RecipeModal from "../components/RecipeModal.jsx";
import { clientCacheService } from "../services/cacheService.js";
import { recipeService } from "../services/recipeService.js";
import { userService } from "../services/userService.js";

const SAVED_RECIPES_CACHE_KEY = "user:savedRecipes";

const editGroups = {
  diet: ["veg", "non-veg", "vegan"],
  healthConditions: ["diabetes", "cholesterol", "pcos", "anaemia", "thyroid"],
  allergies: ["nuts", "dairy", "gluten", "shellfish"],
  deficiencies: ["iron", "calcium", "vitamin-d", "protein"],
};

const editStateShape = {
  name: "",
  age: "",
  gender: "",
  weight: "",
  height: "",
  cookingTime: "",
  diet: "",
  cuisine: "indian",
  healthConditions: [],
  allergies: [],
  deficiencies: [],
};

function getUserInitials(name = "User") {
  const parts = String(name).trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return "U";
  if (parts.length === 1) return parts[0].charAt(0).toUpperCase();
  return `${parts[0].charAt(0)}${parts[1].charAt(0)}`.toUpperCase();
}

function capitalize(value) {
  return String(value || "")
    .replace(/[-_]/g, " ")
    .trim()
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function buildTagList(user) {
  const tags = [];
  const healthConditions = user?.healthConditions || [];
  const diet = user?.preferences?.diet?.[0];

  if (healthConditions.includes("diabetes")) tags.push("Diabetic-friendly");
  if (diet === "veg") tags.push("Vegetarian");
  if (healthConditions.includes("anaemia")) tags.push("Iron Deficiency");
  if (healthConditions.includes("thyroid")) tags.push("Thyroid-safe");
  if (healthConditions.includes("pcos")) tags.push("PCOS-friendly");
  if (healthConditions.includes("cholesterol")) tags.push("Low-cholesterol");

  return tags;
}

function buildEditState(user) {
  return {
    ...editStateShape,
    name: user?.name || "",
    age: user?.basicDetails?.age || "",
    gender: user?.basicDetails?.gender || "",
    weight: user?.basicDetails?.weight || "",
    height: user?.basicDetails?.height || "",
    cookingTime: user?.basicDetails?.cookingTime || "",
    diet: user?.preferences?.diet?.[0] || "",
    cuisine: user?.preferences?.cuisine || "indian",
    healthConditions: user?.healthConditions || [],
    allergies: user?.preferences?.allergies || [],
    deficiencies: user?.preferences?.deficiencies || [],
  };
}

function buildProfilePayload(editState) {
  const basicDetails = {};

  if (editState.age) basicDetails.age = Number(editState.age);
  if (editState.gender) basicDetails.gender = editState.gender;
  if (editState.weight) basicDetails.weight = Number(editState.weight);
  if (editState.height) basicDetails.height = Number(editState.height);
  if (editState.cookingTime) basicDetails.cookingTime = editState.cookingTime;

  return {
    name: editState.name.trim(),
    healthConditions:
      editState.healthConditions.length > 0
        ? editState.healthConditions
        : ["none"],
    preferences: {
      diet: editState.diet ? [editState.diet] : [],
      allergies: editState.allergies,
      cuisine: editState.cuisine || "indian",
      deficiencies:
        editState.deficiencies.length > 0 ? editState.deficiencies : ["none"],
    },
    ...(Object.keys(basicDetails).length > 0 ? { basicDetails } : {}),
  };
}

function toggleListValue(previousValues, value) {
  if (value === "none") {
    return previousValues.includes(value) ? [] : [value];
  }

  if (previousValues.includes("none")) {
    return [value];
  }

  return previousValues.includes(value)
    ? previousValues.filter((item) => item !== value)
    : [...previousValues, value];
}

export default function ProfilePage({ user, token, onUserChange, onLogout }) {
  const [profileUser, setProfileUser] = useState(user || null);
  const [activeTab, setActiveTab] = useState("health-info");
  const [savedRecipes, setSavedRecipes] = useState([]);
  const [selectedRecipe, setSelectedRecipe] = useState(null);
  const [editState, setEditState] = useState(buildEditState(user));
  const [isEditing, setIsEditing] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [status, setStatus] = useState({ type: "", message: "" });

  useEffect(() => {
    setProfileUser(user || null);
    if (!isEditing) {
      setEditState(buildEditState(user));
    }
  }, [user, isEditing]);

  useEffect(() => {
    let isActive = true;

    const loadSavedRecipes = async () => {
      if (!token) {
        setIsLoading(false);
        return;
      }

      const cachedRecipes = clientCacheService.get(SAVED_RECIPES_CACHE_KEY);
      if (Array.isArray(cachedRecipes)) {
        setSavedRecipes(cachedRecipes);
        setIsLoading(false);
        return;
      }

      try {
        const recipes = await recipeService.getSavedRecipes(token);
        if (!isActive) return;

        setSavedRecipes(recipes);
        clientCacheService.set(SAVED_RECIPES_CACHE_KEY, recipes, 5 * 60 * 1000);
      } catch (error) {
        if (!isActive) return;
        console.error("Load profile saved recipes error:", error);
      } finally {
        if (isActive) {
          setIsLoading(false);
        }
      }
    };

    loadSavedRecipes();

    return () => {
      isActive = false;
    };
  }, [token]);

  const savedRecipeIds = useMemo(() => {
    return new Set(
      savedRecipes
        .map((recipe) => recipeService.getRecipeIdentity(recipe))
        .filter(Boolean),
    );
  }, [savedRecipes]);

  const profileTags = useMemo(() => buildTagList(profileUser), [profileUser]);

  const profileSummary = useMemo(() => {
    if (!profileUser) return [];

    return [
      ["Age", profileUser.basicDetails?.age || "-"],
      [
        "Gender",
        profileUser.basicDetails?.gender
          ? capitalize(profileUser.basicDetails.gender)
          : "-",
      ],
      [
        "Weight",
        profileUser.basicDetails?.weight
          ? `${profileUser.basicDetails.weight} kg`
          : "-",
      ],
      [
        "Height",
        profileUser.basicDetails?.height
          ? `${profileUser.basicDetails.height} cm`
          : "-",
      ],
      [
        "Diet",
        profileUser.preferences?.diet?.length
          ? profileUser.preferences.diet
              .map((item) => capitalize(item))
              .join(", ")
          : "-",
      ],
      [
        "Cuisine",
        profileUser.preferences?.cuisine
          ? capitalize(profileUser.preferences.cuisine)
          : "-",
      ],
      ["Cooking Time", profileUser.basicDetails?.cookingTime || "-"],
      [
        "Health Conditions",
        profileUser.healthConditions?.length
          ? profileUser.healthConditions
              .map((item) => capitalize(item))
              .join(", ")
          : "-",
      ],
      [
        "Allergies",
        profileUser.preferences?.allergies?.length
          ? profileUser.preferences.allergies
              .map((item) => capitalize(item))
              .join(", ")
          : "None",
      ],
      [
        "Deficiencies",
        profileUser.preferences?.deficiencies?.length
          ? profileUser.preferences.deficiencies
              .map((item) => capitalize(item))
              .join(", ")
          : "None",
      ],
    ];
  }, [profileUser]);

  const handleSavedRecipeRemove = async (recipe) => {
    const recipeId = recipeService.getRecipeIdentity(recipe);
    if (!token || !recipeId) return;

    try {
      await recipeService.removeSavedRecipe(token, recipeId);
      const nextRecipes = savedRecipes.filter(
        (item) => recipeService.getRecipeIdentity(item) !== recipeId,
      );
      setSavedRecipes(nextRecipes);
      clientCacheService.set(
        SAVED_RECIPES_CACHE_KEY,
        nextRecipes,
        5 * 60 * 1000,
      );
      setStatus({
        type: "success",
        message: "Recipe removed from favourites.",
      });
    } catch (error) {
      setStatus({
        type: "error",
        message: error.message || "Could not remove recipe.",
      });
    }
  };

  const handleSaveProfile = async (event) => {
    event.preventDefault();

    if (!token) return;

    setIsSaving(true);
    setStatus({ type: "", message: "" });

    try {
      const response = await userService.updateProfile(
        token,
        buildProfilePayload(editState),
      );
      const updatedUser = response.data;
      setProfileUser(updatedUser);
      onUserChange?.(updatedUser);
      setEditState(buildEditState(updatedUser));
      setIsEditing(false);
      setStatus({ type: "success", message: "Profile updated successfully." });
    } catch (error) {
      setStatus({
        type: "error",
        message: error.message || "Failed to update profile.",
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteProfile = async () => {
    if (!token) return;

    const shouldDelete = window.confirm(
      "Delete your account permanently? This cannot be undone.",
    );

    if (!shouldDelete) return;

    setIsDeleting(true);

    try {
      await userService.deleteProfile(token);
      clientCacheService.delete(SAVED_RECIPES_CACHE_KEY);
      await onLogout?.();
    } catch (error) {
      setStatus({
        type: "error",
        message: error.message || "Failed to delete profile.",
      });
    } finally {
      setIsDeleting(false);
    }
  };

  if (!profileUser) {
    return <Loader />;
  }

  return (
    <div className="profile-edit-page">
      <section className="profile-edit-shell profile-card">
        <div className="profile-header">
          <div className="profile-avatar">
            <span>{getUserInitials(profileUser.name)}</span>
          </div>
          <div className="profile-header-info">
            <h2>{profileUser.name || "User"}</h2>
            <p>{profileUser.email || "user@email.com"}</p>
            <div className="profile-tags">
              {profileTags.length > 0 ? (
                profileTags.map((tag) => (
                  <span key={tag} className="profile-tag">
                    {tag}
                  </span>
                ))
              ) : (
                <span className="profile-tag">No profile tags yet</span>
              )}
            </div>
          </div>
        </div>

        <div className="profile-tabs">
          {[
            ["health-info", "Health Info"],
            ["saved-recipes", "Saved Recipes"],
          ].map(([tab, label]) => (
            <button
              key={tab}
              type="button"
              className={`profile-tab ${activeTab === tab ? "active" : ""}`}
              onClick={() => setActiveTab(tab)}
            >
              {label}
            </button>
          ))}
        </div>

        <div
          className={`profile-tab-content ${activeTab === "health-info" ? "active" : ""}`}
        >
          {isEditing ? (
            <form className="profile-form" onSubmit={handleSaveProfile}>
              <div className="profile-form-grid">
                <div className="form-section">
                  <h3>Personal Details</h3>
                  <div className="form-group">
                    <label htmlFor="profileName">Name</label>
                    <input
                      id="profileName"
                      value={editState.name}
                      onChange={(event) =>
                        setEditState((previous) => ({
                          ...previous,
                          name: event.target.value,
                        }))
                      }
                    />
                  </div>
                  <div className="form-row">
                    <div className="form-group">
                      <label htmlFor="profileAge">Age</label>
                      <input
                        id="profileAge"
                        type="number"
                        value={editState.age}
                        onChange={(event) =>
                          setEditState((previous) => ({
                            ...previous,
                            age: event.target.value,
                          }))
                        }
                      />
                    </div>
                    <div className="form-group">
                      <label htmlFor="profileGender">Gender</label>
                      <input
                        id="profileGender"
                        value={editState.gender}
                        onChange={(event) =>
                          setEditState((previous) => ({
                            ...previous,
                            gender: event.target.value,
                          }))
                        }
                      />
                    </div>
                  </div>
                  <div className="form-row">
                    <div className="form-group">
                      <label htmlFor="profileWeight">Weight</label>
                      <input
                        id="profileWeight"
                        type="number"
                        value={editState.weight}
                        onChange={(event) =>
                          setEditState((previous) => ({
                            ...previous,
                            weight: event.target.value,
                          }))
                        }
                      />
                    </div>
                    <div className="form-group">
                      <label htmlFor="profileHeight">Height</label>
                      <input
                        id="profileHeight"
                        type="number"
                        value={editState.height}
                        onChange={(event) =>
                          setEditState((previous) => ({
                            ...previous,
                            height: event.target.value,
                          }))
                        }
                      />
                    </div>
                  </div>
                </div>

                <div className="form-section">
                  <h3>Preferences</h3>
                  <div className="form-group">
                    <label htmlFor="profileCookingTime">Cooking Time</label>
                    <input
                      id="profileCookingTime"
                      value={editState.cookingTime}
                      onChange={(event) =>
                        setEditState((previous) => ({
                          ...previous,
                          cookingTime: event.target.value,
                        }))
                      }
                    />
                  </div>
                  <div className="form-group">
                    <label htmlFor="profileDiet">Diet</label>
                    <select
                      id="profileDiet"
                      value={editState.diet}
                      onChange={(event) =>
                        setEditState((previous) => ({
                          ...previous,
                          diet: event.target.value,
                        }))
                      }
                    >
                      <option value="">Select diet</option>
                      {editGroups.diet.map((option) => (
                        <option key={option} value={option}>
                          {capitalize(option)}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="form-group">
                    <label htmlFor="profileCuisine">Cuisine</label>
                    <select
                      id="profileCuisine"
                      value={editState.cuisine}
                      onChange={(event) =>
                        setEditState((previous) => ({
                          ...previous,
                          cuisine: event.target.value,
                        }))
                      }
                    >
                      {[
                        "indian",
                        "mediterranean",
                        "asian",
                        "mexican",
                        "fusion",
                      ].map((option) => (
                        <option key={option} value={option}>
                          {capitalize(option)}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {[
                  ["healthConditions", "Health Conditions"],
                  ["allergies", "Allergies"],
                  ["deficiencies", "Deficiencies"],
                ].map(([field, label]) => (
                  <div className="form-section section-span-2" key={field}>
                    <h3>{label}</h3>
                    <div className="checkbox-group">
                      {editGroups[field].map((option) => (
                        <label className="checkbox-item" key={option}>
                          <input
                            type="checkbox"
                            checked={editState[field].includes(option)}
                            onChange={() =>
                              setEditState((previous) => ({
                                ...previous,
                                [field]: toggleListValue(
                                  previous[field],
                                  option,
                                ),
                              }))
                            }
                          />
                          <span>{capitalize(option)}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                ))}
              </div>

              <div className="profile-actions">
                <button
                  className="btn btn-primary"
                  type="submit"
                  disabled={isSaving}
                >
                  {isSaving ? "Saving..." : "Save Changes"}
                </button>
                <button
                  className="btn btn-secondary"
                  type="button"
                  onClick={() => {
                    setIsEditing(false);
                    setEditState(buildEditState(profileUser));
                    setStatus({ type: "", message: "" });
                  }}
                >
                  Cancel
                </button>
              </div>
            </form>
          ) : (
            <div className="profile-grid">
              {profileSummary.map(([label, value]) => (
                <div className="profile-item" key={label}>
                  <label>{label}</label>
                  <p>{value}</p>
                </div>
              ))}
            </div>
          )}
        </div>

        <div
          className={`profile-tab-content ${activeTab === "saved-recipes" ? "active" : ""}`}
        >
          {savedRecipes.length > 0 ? (
            <div className="recipes-grid-new">
              {savedRecipes.map((recipe) => {
                const recipeId = recipeService.getRecipeIdentity(recipe);
                return (
                  <RecipeCard
                    key={recipeId || recipe.title}
                    recipe={recipe}
                    isSaved={savedRecipeIds.has(recipeId)}
                    showRemoveButton
                    onOpen={setSelectedRecipe}
                    onRemove={handleSavedRecipeRemove}
                  />
                );
              })}
            </div>
          ) : (
            <div className="landing-header react-route-card">
              <div>
                <div className="landing-kicker">Saved Recipes</div>
                <h3>No saved recipes yet</h3>
                <p className="tagline">
                  Recipes you save from the generator or discover pages will
                  appear here.
                </p>
              </div>
            </div>
          )}
        </div>

        <p className={`profile-status ${status.type}`} aria-live="polite">
          {status.message}
        </p>

        <div className="profile-actions">
          {activeTab === "health-info" && !isEditing ? (
            <button
              className="btn btn-primary btn-edit-profile"
              type="button"
              onClick={() => {
                setEditState(buildEditState(profileUser));
                setIsEditing(true);
              }}
            >
              Edit Profile
            </button>
          ) : null}
          <button
            className="btn btn-secondary"
            type="button"
            onClick={handleDeleteProfile}
            disabled={isDeleting}
          >
            {isDeleting ? "Deleting..." : "Delete Account"}
          </button>
        </div>
      </section>

      <RecipeModal
        recipe={selectedRecipe}
        isSaved={
          selectedRecipe
            ? savedRecipeIds.has(
                recipeService.getRecipeIdentity(selectedRecipe),
              )
            : false
        }
        onClose={() => setSelectedRecipe(null)}
        onSave={() => {}}
        onWatchTutorial={() => {}}
      />

      {isLoading ? <Loader /> : null}
    </div>
  );
}
