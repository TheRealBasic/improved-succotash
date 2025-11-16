#include "ChaosArenaManager.h"
#include "ChaosPlayerCharacter.h"
#include "GameFramework/CharacterMovementComponent.h"
#include "Kismet/GameplayStatics.h"
#include "Net/UnrealNetwork.h"
#include "TimerManager.h"
#include "Templates/Function.h"

AChaosArenaManager::AChaosArenaManager()
{
    PrimaryActorTick.bCanEverTick = true;
    bReplicates = true;

    CurrentMinigame = EChaosMinigame::None;
    TimeRemainingInRound = 0.0f;
    MinRoundDuration = 20.0f;
    MaxRoundDuration = 30.0f;
    RoundEndTime = 0.0f;
}

void AChaosArenaManager::BeginPlay()
{
    Super::BeginPlay();

    if (HasAuthority())
    {
        // Ensure None is not in the available minigames when choosing randomly.
        if (!AvailableMinigames.Contains(EChaosMinigame::IceFloor))
        {
            // Provide at least IceFloor as a default available minigame so the system has something to run.
            AvailableMinigames.Add(EChaosMinigame::IceFloor);
        }

        StartNextMinigame();
    }
}

void AChaosArenaManager::Tick(float DeltaSeconds)
{
    Super::Tick(DeltaSeconds);

    if (HasAuthority())
    {
        if (CurrentMinigame != EChaosMinigame::None)
        {
            const float CurrentTime = GetWorld()->GetTimeSeconds();
            TimeRemainingInRound = FMath::Max(0.0f, RoundEndTime - CurrentTime);
        }
        else
        {
            TimeRemainingInRound = 0.0f;
        }
    }
}

void AChaosArenaManager::StartNextMinigame()
{
    if (!HasAuthority())
    {
        return;
    }

    ClearMinigameEffects();

    CurrentMinigame = ChooseRandomMinigame();
    OnRep_CurrentMinigame();

    const float Duration = FMath::FRandRange(MinRoundDuration, MaxRoundDuration);
    RoundEndTime = GetWorld()->GetTimeSeconds() + Duration;

    // Apply the newly selected minigame effects.
    ApplyMinigameEffects();

    // Schedule the end of the round.
    GetWorldTimerManager().ClearTimer(RoundTimerHandle);
    GetWorldTimerManager().SetTimer(RoundTimerHandle, this, &AChaosArenaManager::EndCurrentMinigame, Duration, false);
}

void AChaosArenaManager::EndCurrentMinigame()
{
    if (!HasAuthority())
    {
        return;
    }

    ClearMinigameEffects();
    CurrentMinigame = EChaosMinigame::None;
    OnRep_CurrentMinigame();

    // Immediately start the next chaos round.
    StartNextMinigame();
}

EChaosMinigame AChaosArenaManager::ChooseRandomMinigame() const
{
    TArray<EChaosMinigame> ValidMinigames;

    for (EChaosMinigame Minigame : AvailableMinigames)
    {
        if (Minigame != EChaosMinigame::None)
        {
            ValidMinigames.Add(Minigame);
        }
    }

    if (ValidMinigames.Num() == 0)
    {
        // Fallback to IceFloor if nothing else is configured.
        return EChaosMinigame::IceFloor;
    }

    const int32 Index = FMath::RandRange(0, ValidMinigames.Num() - 1);
    return ValidMinigames[Index];
}

void AChaosArenaManager::ApplyMinigameEffects()
{
    if (!HasAuthority())
    {
        return;
    }

    switch (CurrentMinigame)
    {
        case EChaosMinigame::IceFloor:
            ForEachChaosPlayer([this](AChaosPlayerCharacter* Character)
            {
                ApplyIceFloorToCharacter(Character);
            });
            break;

        case EChaosMinigame::None:
        default:
            break;
    }
}

void AChaosArenaManager::ClearMinigameEffects()
{
    if (!HasAuthority())
    {
        return;
    }

    // Restore movement for any player who was modified.
    for (auto& Entry : StoredMovementSettings)
    {
        if (AChaosPlayerCharacter* Character = Entry.Key.Get())
        {
            RestoreMovementForCharacter(Character);
        }
    }

    StoredMovementSettings.Empty();
}

void AChaosArenaManager::ApplyIceFloorToCharacter(AChaosPlayerCharacter* Character)
{
    if (!Character || !HasAuthority())
    {
        return;
    }

    UCharacterMovementComponent* MoveComp = Character->GetCharacterMovement();
    if (!MoveComp)
    {
        return;
    }

    // Store defaults only once per character for restoration later.
    if (!StoredMovementSettings.Contains(Character))
    {
        FMovementDefaults Defaults;
        Defaults.GroundFriction = MoveComp->GroundFriction;
        Defaults.BrakingDecelerationWalking = MoveComp->BrakingDecelerationWalking;
        StoredMovementSettings.Add(Character, Defaults);
    }

    MoveComp->GroundFriction = 0.2f;
    MoveComp->BrakingDecelerationWalking = 200.0f;
}

void AChaosArenaManager::RestoreMovementForCharacter(AChaosPlayerCharacter* Character)
{
    if (!Character)
    {
        return;
    }

    if (UCharacterMovementComponent* MoveComp = Character->GetCharacterMovement())
    {
        if (FMovementDefaults* Defaults = StoredMovementSettings.Find(Character))
        {
            MoveComp->GroundFriction = Defaults->GroundFriction;
            MoveComp->BrakingDecelerationWalking = Defaults->BrakingDecelerationWalking;
        }
    }
}

void AChaosArenaManager::ForEachChaosPlayer(TFunctionRef<void(AChaosPlayerCharacter*)> Func)
{
    UWorld* World = GetWorld();
    if (!World)
    {
        return;
    }

    TArray<AActor*> FoundActors;
    UGameplayStatics::GetAllActorsOfClass(World, AChaosPlayerCharacter::StaticClass(), FoundActors);

    for (AActor* Actor : FoundActors)
    {
        if (AChaosPlayerCharacter* Character = Cast<AChaosPlayerCharacter>(Actor))
        {
            Func(Character);
        }
    }
}

EChaosMinigame AChaosArenaManager::GetCurrentMinigame() const
{
    return CurrentMinigame;
}

void AChaosArenaManager::ApplyCurrentMinigameToCharacter(AChaosPlayerCharacter* Character)
{
    if (!HasAuthority())
    {
        return;
    }

    switch (CurrentMinigame)
    {
        case EChaosMinigame::IceFloor:
            ApplyIceFloorToCharacter(Character);
            break;

        default:
            RestoreMovementForCharacter(Character);
            break;
    }
}

void AChaosArenaManager::OnRep_CurrentMinigame()
{
    // Notify Blueprints/UI when the minigame changes.
    OnMinigameChanged(CurrentMinigame);
}

void AChaosArenaManager::GetLifetimeReplicatedProps(TArray<FLifetimeProperty>& OutLifetimeProps) const
{
    Super::GetLifetimeReplicatedProps(OutLifetimeProps);

    DOREPLIFETIME(AChaosArenaManager, CurrentMinigame);
    DOREPLIFETIME(AChaosArenaManager, TimeRemainingInRound);
}

