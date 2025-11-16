#include "ChaosPlayerCharacter.h"
#include "Camera/CameraComponent.h"
#include "Components/CapsuleComponent.h"
#include "GameFramework/CharacterMovementComponent.h"
#include "InputAction.h"
#include "InputActionValue.h"
#include "InputMappingContext.h"
#include "EnhancedInputComponent.h"
#include "EnhancedInputSubsystems.h"

AChaosPlayerCharacter::AChaosPlayerCharacter()
{
    PrimaryActorTick.bCanEverTick = false;
    bReplicates = true;

    // Configure capsule size for a typical first-person pawn.
    GetCapsuleComponent()->InitCapsuleSize(55.f, 96.0f);

    // Create and attach the first-person camera.
    FirstPersonCamera = CreateDefaultSubobject<UCameraComponent>(TEXT("FirstPersonCamera"));
    FirstPersonCamera->SetupAttachment(GetCapsuleComponent());
    FirstPersonCamera->bUsePawnControlRotation = true;

    // Character movement defaults.
    WalkSpeed = 600.0f;
    SprintSpeed = 900.0f;

    // Allow controller rotation for a typical FPS feel.
    bUseControllerRotationPitch = true;
    bUseControllerRotationYaw = true;
    bUseControllerRotationRoll = false;

    // Orient rotation to the controller; disable movement-based rotation.
    GetCharacterMovement()->bOrientRotationToMovement = false;
}

void AChaosPlayerCharacter::BeginPlay()
{
    Super::BeginPlay();

    // Ensure our base walking speed is set on spawn.
    GetCharacterMovement()->MaxWalkSpeed = WalkSpeed;

    // Enhanced Input: add mapping context for the locally controlled player only.
    if (APlayerController* PC = Cast<APlayerController>(GetController()))
    {
        if (ULocalPlayer* LocalPlayer = PC->GetLocalPlayer())
        {
            if (UEnhancedInputLocalPlayerSubsystem* Subsystem = ULocalPlayer::GetSubsystem<UEnhancedInputLocalPlayerSubsystem>(LocalPlayer))
            {
                if (IMC_ChaosPlayer)
                {
                    Subsystem->AddMappingContext(IMC_ChaosPlayer, 0);
                }
            }
        }
    }
}

void AChaosPlayerCharacter::SetupPlayerInputComponent(UInputComponent* PlayerInputComponent)
{
    Super::SetupPlayerInputComponent(PlayerInputComponent);

    if (UEnhancedInputComponent* EnhancedInput = Cast<UEnhancedInputComponent>(PlayerInputComponent))
    {
        if (IA_Move)
        {
            EnhancedInput->BindAction(IA_Move, ETriggerEvent::Triggered, this, &AChaosPlayerCharacter::Move);
        }

        if (IA_Look)
        {
            EnhancedInput->BindAction(IA_Look, ETriggerEvent::Triggered, this, &AChaosPlayerCharacter::Look);
        }

        if (IA_Jump)
        {
            EnhancedInput->BindAction(IA_Jump, ETriggerEvent::Started, this, &AChaosPlayerCharacter::Jump);
            EnhancedInput->BindAction(IA_Jump, ETriggerEvent::Completed, this, &AChaosPlayerCharacter::StopJumping);
        }

        if (IA_Sprint)
        {
            EnhancedInput->BindAction(IA_Sprint, ETriggerEvent::Started, this, &AChaosPlayerCharacter::StartSprinting);
            EnhancedInput->BindAction(IA_Sprint, ETriggerEvent::Completed, this, &AChaosPlayerCharacter::StopSprinting);
        }
    }
}

void AChaosPlayerCharacter::Move(const FInputActionValue& Value)
{
    const FVector2D MovementVector = Value.Get<FVector2D>();

    if (Controller)
    {
        // Forward/backward uses Y component; right/left uses X component.
        if (!FMath::IsNearlyZero(MovementVector.Y))
        {
            AddMovementInput(GetActorForwardVector(), MovementVector.Y);
        }

        if (!FMath::IsNearlyZero(MovementVector.X))
        {
            AddMovementInput(GetActorRightVector(), MovementVector.X);
        }
    }
}

void AChaosPlayerCharacter::Look(const FInputActionValue& Value)
{
    const FVector2D LookAxisVector = Value.Get<FVector2D>();

    AddControllerYawInput(LookAxisVector.X);
    AddControllerPitchInput(LookAxisVector.Y);
}

void AChaosPlayerCharacter::StartSprinting()
{
    ApplySprintingSpeed(true);
    ServerSetSprinting(true);
}

void AChaosPlayerCharacter::StopSprinting()
{
    ApplySprintingSpeed(false);
    ServerSetSprinting(false);
}

void AChaosPlayerCharacter::ApplySprintingSpeed(bool bIsSprinting)
{
    if (UCharacterMovementComponent* MoveComp = GetCharacterMovement())
    {
        MoveComp->MaxWalkSpeed = bIsSprinting ? SprintSpeed : WalkSpeed;
    }
}

void AChaosPlayerCharacter::ServerSetSprinting_Implementation(bool bIsSprinting)
{
    ApplySprintingSpeed(bIsSprinting);
}

