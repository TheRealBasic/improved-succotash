#pragma once

#include "CoreMinimal.h"
#include "ChaosMinigameTypes.generated.h"

/**
 * Enum representing the available chaos minigames.
 */
UENUM(BlueprintType)
enum class EChaosMinigame : uint8
{
    None        UMETA(DisplayName = "None"),
    IceFloor    UMETA(DisplayName = "Ice Floor"),
    LowGravity  UMETA(DisplayName = "Low Gravity"),
    FallingTiles UMETA(DisplayName = "Falling Tiles"),
    DodgeBalls  UMETA(DisplayName = "Dodge Balls")
};

