Feature: Dish runs in the lab workspace
  As a lab technician running a method that splits a sample into dishes
  I want each dish compared against the acceptable error before I can finish
  So that the certificate only ever reports a result two dishes agreed on

  A coal sample is split into dishes. Each dish is measured, per-dish
  calculations run over those measurements, and dishes are compared pairwise on
  a target calculation. The first pair (in index order) where every comparison
  passes is accepted, and the reported value is the mean of that pair. If no
  pair agrees, another dish is measured.

  The method used here measures B and C on each dish, calculates G = B + C, and
  accepts a pair whose G differs by no more than 0.3 once rounded to 2 decimals.
  Its formulas are the real generated Python, evaluated by the real browser
  engine — the fake only stores what the browser computed.

  Background:
    Given the following users exist:
      | name        | email             | password    | role  |
      | Avery Admin | admin@example.com | password123 | admin |
    And I am signed in as "admin@example.com" with password "password123"

  Scenario: Two dishes that agree name the accepted pair and allow finishing
    Given a dish-run experiment "ctx-dish-agree" whose first two dishes agree
    When I visit "/internal/experiment/ctx-dish-agree"
    And I compare the dishes
    Then the dish run should say "Dishes 1 and 2 agree — this sample is ready to submit"
    And dishes 1 and 2 should be the accepted pair
    And a result should be reported for the accepted pair
    When I finish the experiment "ctx-dish-agree"
    Then ticket "ctx-dish-agree" should be in the "COMPLETED" stage
    And experiment-manager should have stored a reported result for "ctx-dish-agree"

  Scenario: Dishes that disagree ask for another dish and block finishing
    Given a dish-run experiment "ctx-dish-disagree" whose first two dishes disagree
    When I visit "/internal/experiment/ctx-dish-disagree"
    And I compare the dishes
    Then the dish run should say "The dishes measured so far don’t agree — measure dish 3"
    And dish 3 should be offered for measuring
    And finishing the experiment should be blocked

  Scenario: A method without dishes is unaffected
    Given an experiment "ctx-no-dishes" is at the "IN_PROGRESS" stage
    When I visit "/internal/experiment/ctx-no-dishes"
    Then the dish run panel should not be shown
    When I finish the experiment "ctx-no-dishes"
    Then ticket "ctx-no-dishes" should be in the "COMPLETED" stage
