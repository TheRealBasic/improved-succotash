#pragma once

#include "CoreMinimal.h"
#include "GameFramework/Actor.h"
#include "ChaosMinigameTypes.h"
#include "Templates/Function.h"
#include "ChaosArenaManager.generated.h"

class AChaosPlayerCharacter;
class UCharacterMovementComponent;

/** Simple struct to store movement defaults for a character during the Ice Floor minigame. */
USTRUCT()
struct FMovementDefaults
{
    GENERATED_BODY()

    float GroundFriction = 0.f;
    float BrakingDecelerationWalking = 0.f;
};

/**
 * Arena manager responsible for selecting and applying chaos minigames.
 */
UCLASS(Blueprintable, BlueprintType)
class AChaosArenaManager : public AActor
{
    GENERATED_BODY()

public:
    AChaosArenaManager();

    virtual void BeginPlay() override;
    virtual void Tick(float DeltaSeconds) override;

    /** List of minigames to choose from. None is ignored. */
    UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Chaos")
    TArray<EChaosMinigame> AvailableMinigames;

    /** Replicated current minigame selection. */
    UPROPERTY(ReplicatedUsing = OnRep_CurrentMinigame, BlueprintReadOnly, Category = "Chaos")
    EChaosMinigame CurrentMinigame;

    /** Replicated time remaining in the current round (seconds). */
    UPROPERTY(Replicated, BlueprintReadOnly, Category = "Chaos")
    float TimeRemainingInRound;

    /** Minimum duration for a chaos round (seconds). */
    UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Chaos")
    float MinRoundDuration;

    /** Maximum duration for a chaos round (seconds). */
    UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Chaos")
    float MaxRoundDuration;

    /** Get the current minigame (Blueprint callable for UI). */
    UFUNCTION(BlueprintCallable, Category = "Chaos")
    EChaosMinigame GetCurrentMinigame() const;

    /** Blueprint event to react to minigame changes on clients (UI, VFX, etc.). */
    UFUNCTION(BlueprintImplementableEvent, Category = "Chaos")
    void OnMinigameChanged(EChaosMinigame NewMinigame);

    /** Apply the active minigame effects to a specific character (useful for late-joining players). */
    UFUNCTION(BlueprintCallable, Category = "Chaos")
    void ApplyCurrentMinigameToCharacter(AChaosPlayerCharacter* Character);

protected:
    /** Starts a new random minigame round on the server. */
    void StartNextMinigame();

    /** Ends the current minigame and schedules the next one. */
    void EndCurrentMinigame();

    /** Server-side application of effects for the current minigame. */
    void ApplyMinigameEffects();

    /** Server-side cleanup of the current minigame effects. */
    void ClearMinigameEffects();

    /** Called on clients when CurrentMinigame is replicated. */
    UFUNCTION()
    void OnRep_CurrentMinigame();

    /** Replication setup. */
    virtual void GetLifetimeReplicatedProps(TArray<FLifetimeProperty>& OutLifetimeProps) const override;

private:
    /** Timer handle for ending a round. */
    FTimerHandle RoundTimerHandle;

    /** Timestamp (world time seconds) when the current round ends. */
    float RoundEndTime;

    /** Stored movement defaults per player for the Ice Floor minigame. */
    TMap<TWeakObjectPtr<AChaosPlayerCharacter>, FMovementDefaults> StoredMovementSettings;

    /** Chooses a random minigame from the available list (excluding None). */
    EChaosMinigame ChooseRandomMinigame() const;

    /** Applies the Ice Floor minigame effect to a single character. */
    void ApplyIceFloorToCharacter(AChaosPlayerCharacter* Character);

    /** Restores a character's movement settings after Ice Floor. */
    void RestoreMovementForCharacter(AChaosPlayerCharacter* Character);

    /** Helper to iterate over all characters in the world. */
    void ForEachChaosPlayer(TFunctionRef<void(AChaosPlayerCharacter*)> Func);
};

